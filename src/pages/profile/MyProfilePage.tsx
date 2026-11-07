import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiInfo,
  FiKey,
  FiLock,
  FiMail,
  FiShield,
  FiX,
  FiEdit2,
  FiBriefcase,
} from "react-icons/fi";
import { toastError, toastSuccess } from "../../utils/toast";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/FormField";
import Input from "../../components/ui/Input";
import { cn } from "../../utils/cn";
import {
  useUserProfile,
  useUpdateUserMutation,
  useChangePasswordMutation,
} from "../../hooks/useUsers";
import { useMyProjects } from "../../hooks/useProjects";
import { getInitials } from "../../utils/getInitials";

function CopyField({ label, value, displayValue }: { label: string; value: string; displayValue?: string }) {
  const [copied, setCopied] = useState(false);
  const hasValue = value.length > 0;

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toastError(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <div className="min-w-0 rounded-xl bg-bg-primary px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-semibold text-text-primary" title={displayValue || value}>{displayValue ?? value}</p>
        <button
          type="button"
          onClick={copyValue}
          title={copied ? "Copied" : "Copy"}
          aria-label={`${copied ? "Copied" : "Copy"} ${label}`}
          disabled={!hasValue}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? <FiCheck className="h-3.5 w-3.5 text-[#2E8B60]" /> : <FiCopy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function InformationField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-bg-primary px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-1.5 truncate text-[13px] font-semibold text-text-primary" title={value}>{value}</p>
    </div>
  );
}

const MyProfilePage: React.FC = () => {
  const { user, isLoading, isError, error, refetch, isFetching } = useUserProfile();
  const { updateUser, isLoading: isProfileSaving } = useUpdateUserMutation();
  const { changePassword } = useChangePasswordMutation();
  const { projects, data: projectsData } = useMyProjects({ pageNumber: 1, pageSize: 100 });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: "", username: "" });
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (user && !isEditingProfile) {
      setProfileDraft({ fullName: user.fullName || "", username: user.username || "" });
    }
  }, [user, isEditingProfile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    const fullName = profileDraft.fullName.trim();
    const username = profileDraft.username.trim();
    if (!fullName || !username) {
      toastError("Full name and username are required.");
      return;
    }
    if (fullName === user.fullName && username === user.username) {
      setIsEditingProfile(false);
      return;
    }

    try {
      await updateUser({ id: user.id, fullName, email: user.email, username });
      toastSuccess("Profile updated successfully.");
      setIsEditingProfile(false);
    } catch {
      toastError("Could not update your profile.");
    }
  };

  const handleCancelProfileEdit = () => {
    setProfileDraft({ fullName: user?.fullName || "", username: user?.username || "" });
    setIsEditingProfile(false);
  };

  const resetPasswordForm = () => {
    setIsResettingPassword(false);
    setStatus(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await changePassword({ oldPassword: currentPassword, newPassword });
      const successMessage = response.message || "Password successfully updated.";
      setStatus({ type: "success", message: successMessage });
      toastSuccess(successMessage);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        setIsResettingPassword(false);
        setStatus(null);
      }, 2200);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || "Could not update password.";
      setStatus({ type: "error", message: errorMessage });
      toastError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="md" />
          <p className="text-[11px] font-semibold text-text-secondary">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-bg-primary px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface-white p-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary"><FiInfo className="h-5 w-5" /></div>
          <h2 className="text-xl font-bold text-text-primary">Could not load your profile</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{error || "Please try again in a moment."}</p>
          <Button className="mx-auto mt-6" onClick={() => void refetch()} isLoading={isFetching}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const displayName = user.fullName?.trim() || user.username?.trim() || "SLRS User";
  const displayUsername = user.username?.trim() || "Username not set";
  const userId = user.id || (user as typeof user & { uid?: string }).uid || "";
  const roleLabel = user.role?.trim() || "User";
  const isAccountActive = user.isActive !== false;
  const activeProjects = projects.filter((project) => project.statusText === "Active").length;
  const roleBadgeStyle = user.role?.toLowerCase() === "admin"
    ? "bg-primary-light text-primary-hover"
    : "bg-primary-light text-accent";

  return (
    <div className="min-h-[calc(100vh-72px)] bg-bg-primary px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
      <main className="mx-auto max-w-[1160px] space-y-8">
        <header className="mb-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Account settings</p>
          <h1 className="text-[32px] font-bold tracking-[-0.025em] text-text-primary sm:text-[38px]">Profile</h1>
          <p className="mt-2 text-[14px] text-text-secondary">Manage your personal information and account settings.</p>
        </header>

        <section aria-labelledby="profile-overview-title" className="overflow-hidden rounded-xl border border-border bg-surface-white">
          <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10 lg:p-8">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-xl bg-accent text-[30px] font-bold tracking-[-0.025em] text-white">
                {getInitials(displayName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 id="profile-overview-title" className="text-[25px] font-bold leading-tight tracking-[-0.04em] text-text-primary sm:text-[29px]">{displayName}</h2>
                  <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold", roleBadgeStyle)}>{roleLabel}</span>
                </div>
                <p className="mt-1 text-[12px] font-medium text-text-muted">@{displayUsername}</p>
                <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[12px] text-text-secondary"><FiMail className="h-3.5 w-3.5 shrink-0 text-text-muted" /><span className="truncate">{user.email}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl bg-bg-primary px-3.5 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-text-muted">Role</p>
                <p className="mt-1.5 truncate text-[12px] font-bold text-text-primary">{roleLabel}</p>
              </div>
              <div className="rounded-xl bg-bg-primary px-3.5 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-text-muted">Projects</p>
                <p className="mt-1.5 text-[12px] font-bold text-text-primary">{projectsData?.totalCount ?? projects.length} total <span className="font-medium text-text-muted">· {activeProjects} active</span></p>
              </div>
              <div className="col-span-2 rounded-xl bg-bg-primary px-3.5 py-3 sm:col-span-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-text-muted">Account status</p>
                <p className={`mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold ${isAccountActive ? "text-success" : "text-error"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isAccountActive ? "bg-success" : "bg-error"}`} />{isAccountActive ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border bg-bg-primary px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-[11px] text-text-muted">Keep your account details up to date.</p>
            {isEditingProfile ? (
              <div className="flex w-full gap-2 sm:w-auto">
                <Button size="md" variant="outline" onClick={handleCancelProfileEdit} disabled={isProfileSaving} className="flex-1 sm:flex-none">Cancel</Button>
                <Button size="md" onClick={handleSaveProfile} isLoading={isProfileSaving} className="flex-1 sm:flex-none"><FiCheck className="mr-1.5" />Save changes</Button>
              </div>
            ) : (
              <Button size="md" variant="secondary" onClick={() => setIsEditingProfile(true)} className="w-full sm:w-auto"><FiEdit2 className="mr-2 h-3.5 w-3.5" />Edit profile</Button>
            )}
          </div>
        </section>

        <section aria-labelledby="personal-info-title" className="rounded-xl border border-border bg-surface-white p-5 sm:p-7">
          <div className="mb-5">
            <h2 id="personal-info-title" className="text-[20px] font-bold tracking-[-0.03em] text-text-primary">Personal information</h2>
            <p className="mt-1 text-[12px] text-text-muted">Manage your identity and contact details.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {isEditingProfile ? (
              <label className="rounded-xl bg-bg-primary px-4 py-3.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Full name</span>
                <Input value={profileDraft.fullName} onChange={(event) => setProfileDraft((draft) => ({ ...draft, fullName: event.target.value }))} autoFocus className="mt-2 h-9 rounded-xl border-border bg-surface-white text-[13px]" />
              </label>
            ) : <InformationField label="Full name" value={displayName} />}

            {isEditingProfile ? (
              <label className="rounded-xl bg-bg-primary px-4 py-3.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Username</span>
                <Input value={profileDraft.username} onChange={(event) => setProfileDraft((draft) => ({ ...draft, username: event.target.value }))} className="mt-2 h-9 rounded-xl border-border bg-surface-white text-[13px]" />
              </label>
            ) : <InformationField label="Username" value={displayUsername} />}

            <CopyField label="Email address" value={user.email || "Not provided"} />
            <CopyField label="User ID" value={userId} />
          </div>
          {isEditingProfile && <p className="mt-3 text-[10px] text-text-muted">Email address cannot be changed here.</p>}
        </section>

        <section aria-labelledby="security-title" className="rounded-xl border border-border bg-surface-white p-5 sm:p-7">
          <div className="mb-5">
            <h2 id="security-title" className="text-[20px] font-bold tracking-[-0.03em] text-text-primary">Security & account</h2>
            <p className="mt-1 text-[12px] text-text-muted">Manage how you access and protect your account.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl bg-bg-primary p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-white text-accent"><FiLock className="h-[17px] w-[17px]" /></span>
              <div>
                <p className="text-[13px] font-bold text-text-primary">Password</p>
                <p className="mt-1 text-[11px] leading-5 text-text-muted">Use a strong password to keep your account secure.</p>
              </div>
            </div>
            {!isResettingPassword && <Button size="md" variant="secondary" onClick={() => setIsResettingPassword(true)} className="w-full sm:w-auto"><FiKey className="mr-2 h-3.5 w-3.5" />Change password</Button>}
          </div>

          {isResettingPassword && (
            <form onSubmit={handleResetPassword} className="mt-4 rounded-2xl border border-border bg-surface-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><p className="text-[13px] font-bold text-text-primary">Update password</p><p className="mt-1 text-[11px] text-text-muted">Choose a new password you do not use elsewhere.</p></div>
                <button type="button" onClick={resetPasswordForm} aria-label="Cancel password change" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"><FiX /></button>
              </div>

              {status && <div className={cn("mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px]", status.type === "success" ? "bg-[#EFF8F2] text-[#327B55]" : "bg-[#FBF2F1] text-[#A04F4B]")}>{status.type === "success" ? <FiCheckCircle className="shrink-0" /> : <FiInfo className="shrink-0" />}{status.message}</div>}

              <div className="space-y-4">
                <FormField id="current-password" label="Current password" type="password" placeholder="Enter current password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="new-password" label="New password" type="password" placeholder="Enter new password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} helperText="At least 8 characters" />
                  <FormField id="confirm-password" label="Confirm new password" type="password" placeholder="Re-enter new password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} errorMessage={confirmPassword && newPassword !== confirmPassword ? "Passwords do not match" : undefined} />
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" size="md" onClick={resetPasswordForm} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" size="md" isLoading={isSubmitting} disabled={isSubmitting || (!!newPassword && newPassword !== confirmPassword)}><FiCheck className="mr-1.5" />Save password</Button>
              </div>
            </form>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-accent"><FiShield className="h-4 w-4" /></span>
              <div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">Account status</p><p className={`mt-1 text-[12px] font-bold ${isAccountActive ? "text-success" : "text-error"}`}>{isAccountActive ? "Active" : "Inactive"}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-accent"><FiBriefcase className="h-4 w-4" /></span>
              <div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">Account role</p><p className="mt-1 text-[12px] font-bold text-text-primary">{roleLabel}</p></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default MyProfilePage;
