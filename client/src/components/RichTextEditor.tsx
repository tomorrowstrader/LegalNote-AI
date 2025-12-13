import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, disabled, placeholder }: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing...',
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ],
    content: content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) {
        return;
      }
      const markdown = editor.storage.markdown.getMarkdown();
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 text-foreground',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    
    const currentMarkdown = editor.storage.markdown?.getMarkdown() || '';
    if (content !== currentMarkdown) {
      isUpdatingRef.current = true;
      editor.commands.setContent(content);
      isUpdatingRef.current = false;
    }
  }, [editor, content]);

  useEffect(() => {
    if (editor && disabled !== undefined) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const handleHeading1 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 1 }).run();
  }, [editor]);

  const handleHeading2 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const handleHeading3 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 3 }).run();
  }, [editor]);

  const handleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const handleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`rounded-md overflow-hidden ${disabled ? 'bg-muted/20' : 'border border-input bg-background'}`}>
      {!disabled && (
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
              onClick={handleBold}
              disabled={disabled}
              className="h-8 w-8"
              data-testid="button-format-bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold (Ctrl+B)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
              onClick={handleItalic}
              disabled={disabled}
              className="h-8 w-8"
              data-testid="button-format-italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic (Ctrl+I)</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
              onClick={handleHeading1}
              disabled={disabled}
              className="h-8 w-8"
              data-testid="button-format-h1"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 1</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
              onClick={handleHeading2}
              disabled={disabled}
              className="h-8 w-8"
              data-testid="button-format-h2"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 2</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
              onClick={handleHeading3}
              disabled={disabled}
              className="h-8 w-8"
              data-testid="button-format-h3"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 3</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
              onClick={handleBulletList}
              disabled={disabled}
              className="h-8 w-8"
              data-testid="button-format-ul"
            >
              <List className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bullet List</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
              onClick={handleOrderedList}
              disabled={disabled}
              className="h-8 w-8"
              data-testid="button-format-ol"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Numbered List</TooltipContent>
        </Tooltip>
      </div>
      )}

      <EditorContent 
        editor={editor} 
        className="[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-4 [&_.ProseMirror]:focus:outline-none
          [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:mt-4
          [&_.ProseMirror_h1]:sticky [&_.ProseMirror_h1]:top-0 [&_.ProseMirror_h1]:bg-background [&_.ProseMirror_h1]:py-2 [&_.ProseMirror_h1]:z-10 [&_.ProseMirror_h1]:border-b [&_.ProseMirror_h1]:border-border
          [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-3
          [&_.ProseMirror_h2]:sticky [&_.ProseMirror_h2]:top-8 [&_.ProseMirror_h2]:bg-background [&_.ProseMirror_h2]:py-1.5 [&_.ProseMirror_h2]:z-[9]
          [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-2
          [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p]:leading-relaxed
          [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-2
          [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-2
          [&_.ProseMirror_li]:mb-1
          [&_.ProseMirror_strong]:font-bold
          [&_.ProseMirror_em]:italic
          [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground
          [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
          [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left
          [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none
          [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0"
        data-testid="editor-rich-text"
      />
    </div>
  );
}
