import { describe, expect, it } from 'vitest';
import { getRepositoryApiBase, getRepositoryApiDocsUrl } from './apiUrls';

describe('repository API base URL', () => {
  it('keeps the API prefix for actual requests', () => {
    expect(getRepositoryApiBase('http://localhost:5173', 'http://localhost:5000/api'))
      .toBe('http://localhost:5000/api');
  });

  it('uses the local Vite API proxy by default', () => {
    expect(getRepositoryApiBase('http://localhost:5173', '/api'))
      .toBe('http://localhost:5173/api');
  });
});

describe('repository API docs URL', () => {
  it('opens docs on the backend origin when the API URL is absolute', () => {
    expect(getRepositoryApiDocsUrl('http://localhost:5173', 'http://localhost:5000/api'))
      .toBe('http://localhost:5000/repository-api-docs');
  });

  it('keeps same-origin docs reachable through the local Vite proxy', () => {
    expect(getRepositoryApiDocsUrl('http://localhost:5173', '/api'))
      .toBe('http://localhost:5173/repository-api-docs');
  });
});
