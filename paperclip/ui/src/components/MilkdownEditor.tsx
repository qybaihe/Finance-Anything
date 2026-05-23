import { forwardRef, useImperativeHandle, useRef, type ForwardedRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

export interface MilkdownEditorHandle {
  getMarkdown: () => string;
}

function MilkdownEditorSurface({
  editorKey,
  initialMarkdown,
  theme,
}: {
  editorKey: string;
  initialMarkdown: string;
  theme: "light" | "dark";
}, ref: ForwardedRef<MilkdownEditorHandle>) {
  const crepeRef = useRef<Crepe | null>(null);
  const { t } = useLanguage();

  const { loading } = useEditor(
    (root) => {
      const crepe = new Crepe({
        root,
        defaultValue: initialMarkdown,
      });
      crepeRef.current = crepe;
      return crepe;
    },
    [editorKey, initialMarkdown],
  );

  useImperativeHandle(ref, () => ({
    getMarkdown: () => crepeRef.current?.getMarkdown() ?? initialMarkdown,
  }), [initialMarkdown]);

  return (
    <div
      className={cn(
        "knowledge-editor-shell rounded-2xl border bg-card shadow-xs",
        theme === "light" ? "knowledge-editor-shell--light" : "knowledge-editor-shell--dark",
      )}
    >
      <div className="min-h-[30rem] bg-background/60 px-2 py-4">
        {loading ? <div className="px-4 py-8 text-sm text-muted-foreground">{t("Mounting knowledge editor...")}</div> : null}
        <Milkdown />
      </div>
    </div>
  );
}

const ForwardSurface = forwardRef(MilkdownEditorSurface);

export const MilkdownEditor = forwardRef<MilkdownEditorHandle, {
  editorKey: string;
  initialMarkdown: string;
  theme: "light" | "dark";
}>(function MilkdownEditor({
  editorKey,
  initialMarkdown,
  theme,
}, ref) {
  return (
    <MilkdownProvider>
      <ForwardSurface ref={ref} editorKey={editorKey} initialMarkdown={initialMarkdown} theme={theme} />
    </MilkdownProvider>
  );
});
