import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { getRememberedInvitePath } from "../lib/invite-memory";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { Sparkles } from "lucide-react";

type AuthMode = "sign_in" | "sign_up";
const USERNAME_EMAIL_DOMAIN = "finance-anything.local";

function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function usernameToEmail(value: string) {
  const username = normalizeUsername(value);
  if (username.includes("@")) return username.toLowerCase();
  const encoded = Array.from(username)
    .map((char) => {
      if (/^[a-z0-9_-]$/i.test(char)) return char.toLowerCase();
      return `u${char.codePointAt(0)?.toString(16) ?? "0"}`;
    })
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "user";
  return `${encoded}@${USERNAME_EMAIL_DOMAIN}`;
}

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_up");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(
    () => searchParams.get("next") || getRememberedInvitePath() || "/",
    [searchParams],
  );
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  const mutation = useMutation({
    mutationFn: async () => {
      const normalizedUsername = normalizeUsername(username);
      const email = usernameToEmail(normalizedUsername);
      if (mode === "sign_in") {
        await authApi.signInEmail({ email, password });
        return;
      }
      await authApi.signUpEmail({
        name: normalizedUsername,
        email,
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "登录失败，请检查用户名和密码");
    },
  });

  const canSubmit =
    normalizeUsername(username).length > 0 &&
    password.trim().length > 0;

  if (isSessionLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">正在加载...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Left half — form */}
      <div className="flex w-full flex-col overflow-y-auto md:w-1/2">
        <div className="mx-auto my-auto w-full max-w-md px-6 py-8 sm:px-8 sm:py-12">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Finance Anything</span>
          </div>

          <h1 className="text-xl font-semibold">
            {mode === "sign_in" ? "登录 Finance Anything" : "创建你的 Finance Anything 账户"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "用用户名和密码进入你的决策工作空间。"
              : "只需要用户名和密码，进入后就可以直接提出决策目标。"}
          </p>

          <form
            className="mt-6 space-y-4"
            method="post"
            action={mode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending) return;
              if (!canSubmit) {
                setError("请填写用户名和密码");
                return;
              }
              mutation.mutate();
            }}
          >
            <div>
              <label htmlFor="username" className="text-xs text-muted-foreground mb-1 block">用户名</label>
              <input
                id="username"
                name="username"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs text-muted-foreground mb-1 block">密码</label>
              <input
                id="password"
                name="password"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={mutation.isPending}
              aria-disabled={!canSubmit || mutation.isPending}
              className={`w-full ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
            >
              {mutation.isPending
                ? "处理中..."
                : mode === "sign_in"
                  ? "登录"
                  : "注册并进入"}
            </Button>
          </form>

          <div className="mt-5 text-sm text-muted-foreground">
            {mode === "sign_in" ? "还没有账户？" : "已经注册过？"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => {
                setError(null);
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              }}
            >
              {mode === "sign_in" ? "立即注册" : "直接登录"}
            </button>
          </div>
        </div>
      </div>

      {/* Right half — ASCII art animation (hidden on mobile) */}
      <div className="hidden md:block w-1/2 overflow-hidden">
        <AsciiArtAnimation />
      </div>
    </div>
  );
}
