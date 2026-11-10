// Paper Import Service - API Integration Layer
// Handles RIS file upload with progress tracking
// Source: PaperAPI.md

import api from "../config/axios";
import type {
  RisFileImportRequest,
  RisImportResponse,
  BibTexFileImportRequest,
  PdfFileImportRequest,
  PdfFilesImportRequest,
  PdfBatchImportResponse,
  FileValidationResult,
  DoiImportRequest,
  CrossrefImportRequest,
  CrossrefQueryParameters,
  CrossrefWorksResponse,
  CrossrefWorkDetailResponse,
} from "../types/paper";

/**
 * File Upload Configuration
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".ris", ".bib", ".pdf"];
export const MAX_PDF_BATCH_FILES = 10;

/**
 * Validate import file before upload
 */
export const validateImportFile = (file: File): FileValidationResult => {
  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Invalid file type. Only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed.`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  // Check file not empty
  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty.",
    };
  }

  return { valid: true };
};

/**
 * Progress callback function type
 */
export type ProgressCallback = (progressPercent: number) => void;

export type PdfBatchProgress = {
  index: number;
  percent: number;
  status: 'SIGNING' | 'UPLOADING' | 'FINALIZING' | 'IMPORTED' | 'FAILED';
  error?: string;
};
export type PdfBatchProgressCallback = (progress: PdfBatchProgress) => void;

interface PdfUploadSignature {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  type?: "authenticated";
  baseName: string;
  fileName: string;
  expectedPublicId: string;
}

interface CloudinaryUploadResult {
  public_id: string;
  bytes: number;
  secure_url: string;
}

function uploadPdfToCloudinary(
  file: File,
  signature: PdfUploadSignature,
  onProgress: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signature.apiKey);
    form.append('timestamp', String(signature.timestamp));
    form.append('signature', signature.signature);
    form.append('folder', signature.folder);
    form.append('public_id', signature.publicId);
    if (signature.type) form.append('type', signature.type);

    const request = new XMLHttpRequest();
    request.open('POST', signature.uploadUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error('Network error while uploading to Cloudinary'));
    request.onabort = () => reject(new Error('Upload was cancelled'));
    request.onload = () => {
      let response: CloudinaryUploadResult & { error?: { message?: string } };
      try {
        response = JSON.parse(request.responseText);
      } catch {
        reject(new Error('Cloudinary returned an invalid response'));
        return;
      }
      if (request.status < 200 || request.status >= 300 || !response.public_id) {
        reject(new Error(response.error?.message || 'Cloudinary upload failed'));
        return;
      }
      resolve(response);
    };
    request.send(form);
  });
}

/**
 * Paper Import Service
 * Implements RIS file import endpoint from PaperAPI.md
 */
export const paperImportService = {
  async importPdfFile(
    request: PdfFileImportRequest,
    onProgress?: ProgressCallback,
  ): Promise<RisImportResponse> {
    const validation = validateImportFile(request.file);
    if (!validation.valid || !request.file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Invalid file type. Only .pdf files are allowed.");
    }

    const formData = new FormData();
    formData.append("file", request.file);
    formData.append("projectId", request.projectId);
    if (request.searchSourceId) formData.append("searchSourceId", request.searchSourceId);

    const response = await api.post<RisImportResponse>("/papers/import/pdf", formData, {
      params: { projectId: request.projectId },
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded * 100) / event.total));
      },
    });
    const result = response.data;
    if (!result.isSuccess) {
      throw new Error(result.message || "Failed to import PDF file");
    }
    return result;
  },

  /**
   * Import up to MAX_PDF_BATCH_FILES PDFs in one request
   * POST /api/papers/import/pdf/batch
   *
   * Files are imported independently: the result lists each file's outcome. When no file
   * could be imported the backend answers 400 with the same result shape, which is returned
   * here (isSuccess = false) so the caller can show per-file errors.
   */
  async importPdfFiles(
    request: PdfFilesImportRequest,
    onProgress?: PdfBatchProgressCallback,
  ): Promise<PdfBatchImportResponse> {
    if (request.files.length === 0) throw new Error("Please select at least one PDF file.");
    if (request.files.length > MAX_PDF_BATCH_FILES) {
      throw new Error(`You can import at most ${MAX_PDF_BATCH_FILES} PDF files at once.`);
    }

    const assets: Array<PdfUploadSignature & { publicId: string; sizeBytes: number; index: number }> = [];
    const items: PdfBatchImportResponse['data']['items'] = new Array(request.files.length);
    let next = 0;
    const worker = async () => {
      while (next < request.files.length) {
        const index = next++;
        const file = request.files[index];
        try {
          const validation = validateImportFile(file);
          if (!validation.valid || !file.name.toLowerCase().endsWith('.pdf')) {
            throw new Error(validation.error || 'Only PDF files are supported');
          }
          onProgress?.({ index, percent: 0, status: 'SIGNING' });
          const signed = await api.post<{ data: PdfUploadSignature }>(
            '/papers/import/pdf/upload-signature',
            { projectId: request.projectId, fileName: file.name },
          );
          const signature = signed.data.data;
          onProgress?.({ index, percent: 0, status: 'UPLOADING' });
          const uploaded = await uploadPdfToCloudinary(file, signature, (percent) =>
            onProgress?.({ index, percent, status: 'UPLOADING' }),
          );
          if (uploaded.public_id !== signature.expectedPublicId) {
            throw new Error('Uploaded PDF does not match its signed storage path');
          }
          assets.push({ ...signature, publicId: uploaded.public_id, sizeBytes: uploaded.bytes || file.size, index });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Upload failed';
          items[index] = { fileName: file.name, status: 'FAILED', error: message, errorCode: 'UPLOAD_FAILED' };
          onProgress?.({ index, percent: 0, status: 'FAILED', error: message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, request.files.length) }, worker));

    if (assets.length > 0) {
      assets.forEach(({ index }) => onProgress?.({ index, percent: 100, status: 'FINALIZING' }));
      try {
        const response = await api.post<PdfBatchImportResponse>('/papers/import/pdf/batch/finalize', {
          projectId: request.projectId,
          searchSourceId: request.searchSourceId,
          assets: assets.map(({ publicId, baseName, fileName, sizeBytes }) => ({ publicId, baseName, fileName, sizeBytes })),
        });
        const finalized = response.data.data?.items ?? [];
        assets.forEach(({ index }, assetIndex) => {
          items[index] = finalized[assetIndex] ?? { fileName: request.files[index].name, status: 'FAILED', error: 'Import finalization failed' };
          onProgress?.({
            index,
            percent: 100,
            status: items[index].status,
            ...(items[index].error ? { error: items[index].error } : {}),
          });
        });
        const data = response.data.data;
        const imported = items.filter((item) => item?.status === 'IMPORTED').length;
        const failed = request.files.length - imported;
        return {
          ...response.data,
          isSuccess: imported > 0,
          data: {
            ...data,
            totalRecords: request.files.length,
            importedRecords: imported,
            skippedRecords: failed,
            importedPaperIds: items.filter((item) => item?.paperId).map((item) => item!.paperId!),
            errors: items.filter((item) => item?.status === 'FAILED').map((item) => `${item.fileName}: ${item.error || 'Import failed'}`),
            items,
          },
        };
      } catch (error) {
        const data = (error as { response?: { data?: PdfBatchImportResponse } }).response?.data;
        if (!data?.data?.items) {
          assets.forEach(({ index }) => {
            items[index] = { fileName: request.files[index].name, status: 'FAILED', error: 'Could not finalize the uploaded PDF', errorCode: 'FINALIZE_FAILED' };
            onProgress?.({ index, percent: 100, status: 'FAILED', error: 'Could not finalize the uploaded PDF' });
          });
          throw error;
        }
        assets.forEach(({ index }, assetIndex) => {
          items[index] = data.data.items[assetIndex] ?? { fileName: request.files[index].name, status: 'FAILED', error: 'Import finalization failed' };
          onProgress?.({ index, percent: 100, status: items[index].status, ...(items[index].error ? { error: items[index].error } : {}) });
        });
        return {
          ...data,
          data: {
            ...data.data,
            totalRecords: request.files.length,
            importedRecords: items.filter((item) => item?.status === 'IMPORTED').length,
            skippedRecords: items.filter((item) => item?.status !== 'IMPORTED').length,
            items,
          },
        };
      }
    }

    const failedItems = items.filter(Boolean);
    return {
      isSuccess: false,
      message: 'No PDF files could be uploaded',
      errors: null,
      data: {
        importBatchId: null,
        totalRecords: request.files.length,
        importedRecords: 0,
        duplicateRecords: 0,
        skippedRecords: request.files.length,
        updatedRecords: 0,
        errors: failedItems.map((item) => `${item.fileName}: ${item.error || 'Upload failed'}`),
        importedPaperIds: [],
        items,
      },
    };
  },

  /**
   * Import RIS file with progress tracking
   * POST /api/papers/import/ris
   * Content-Type: multipart/form-data
   *
   * @param request - RIS file import request
   * @param onProgress - Optional callback for upload progress
   * @returns Import result with statistics
   */
  async importRisFile(
    request: RisFileImportRequest,
    onProgress?: ProgressCallback,
  ): Promise<RisImportResponse> {
    // Client-side validation
    const validation = validateImportFile(request.file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Build FormData
    const formData = new FormData();
    formData.append("file", request.file);
    formData.append("projectId", request.projectId);

    if (request.searchSourceId) {
      formData.append("searchSourceId", request.searchSourceId);
    }
    if (request.searchExecutionId) {
      formData.append("searchExecutionId", request.searchExecutionId);
    }

    // Upload with progress tracking
    const response = await api.post<RisImportResponse>("/papers/import/ris", formData, {
      params: { projectId: request.projectId },
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    const result = response.data;
    if (!result.isSuccess) {
      throw new Error(result.message || "Failed to import RIS file");
    }
    return result;
  },

  /**
   * Import BibTeX file with progress tracking
   * POST /api/papers/import/bibtex
   * Content-Type: multipart/form-data
   *
   * @param request - BibTeX file import request
   * @param onProgress - Optional callback for upload progress
   * @returns Import result with statistics
   */
  async importBibTexFile(
    request: BibTexFileImportRequest,
    onProgress?: ProgressCallback,
  ): Promise<RisImportResponse> {
    // Client-side validation
    const validation = validateImportFile(request.file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Build FormData
    const formData = new FormData();
    formData.append("file", request.file);
    formData.append("projectId", request.projectId);

    if (request.searchSourceId) {
      formData.append("searchSourceId", request.searchSourceId);
    }
    if (request.searchExecutionId) {
      formData.append("searchExecutionId", request.searchExecutionId);
    }

    // Upload with progress tracking
    const response = await api.post<RisImportResponse>("/papers/import/bibtex", formData, {
      params: { projectId: request.projectId },
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    const result = response.data;
    if (!result.isSuccess) {
      throw new Error(result.message || "Failed to import BibTeX file");
    }
    return result;
  },

  /**
   * Quick import for drag-and-drop or single file upload
   * Automatically detects file type based on extension
   */
  async quickImport(
    file: File,
    projectId: string,
    searchSourceId?: string,
    onProgress?: ProgressCallback,
    searchExecutionId?: string,
  ): Promise<RisImportResponse> {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".bib")) {
      return this.importBibTexFile(
        {
          file,
          projectId,
          searchSourceId,
          searchExecutionId,
        },
        onProgress,
      );
    }

    return this.importRisFile(
      {
        file,
        projectId,
        searchSourceId,
        searchExecutionId,
      },
      onProgress,
    );
  },

  /**
   * Import paper by DOI
   * POST /api/papers/import/doi
   */
  async importByDoi(request: DoiImportRequest): Promise<RisImportResponse> {
    const response = await api.post<RisImportResponse>("/papers/import/doi", request);
    const result = response.data;
    if (!result.isSuccess) {
      throw new Error(result.message || "Failed to import paper by DOI");
    }
    return result;
  },

  /**
   * Import papers from Crossref API
   * POST /api/papers/import/cross-ref
   */
  async importFromCrossref(request: CrossrefImportRequest): Promise<RisImportResponse> {
    const response = await api.post<RisImportResponse>("/papers/import/cross-ref", request);
    const result = response.data;
    if (!result.isSuccess) {
      throw new Error(result.message || "Failed to import papers from Crossref");
    }
    return result;
  },

  /**
   * Search for academic works via Crossref Proxy
   * GET /api/works
   */
  async searchWorks(params: CrossrefQueryParameters): Promise<CrossrefWorksResponse> {
    const response = await api.get<CrossrefWorksResponse>("/works", { params });
    const result = response.data;
    if (!result.isSuccess) {
      throw new Error(result.message || "Failed to search Crossref works");
    }
    return result;
  },

  /**
   * Get full details for a specific work via DOI
   * GET /api/works/{doi}
   */
  async getWorkDetail(doi: string): Promise<CrossrefWorkDetailResponse> {
    // DOIs can contain slashes, which should be encoded or handled correctly by axios
    const response = await api.get<CrossrefWorkDetailResponse>(`/works/${encodeURIComponent(doi)}`);
    const result = response.data;
    if (!result.isSuccess) {
      throw new Error(result.message || "Failed to fetch work details");
    }
    return result;
  },
};
