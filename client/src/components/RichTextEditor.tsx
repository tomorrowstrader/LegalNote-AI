import { useEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, Highlighter, Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon, Table as TableIcon, Search,
  Maximize2, Minimize2, Type
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

function ensureBoldHeadings(content: string): string {
  if (!content) return content;
  
  const knownHeadings = [
    'ATTENDANCE NOTE', 'MEETING SUMMARY', 'MATTERS DISCUSSED', 'NEXT STEPS',
    'KEY POINTS', 'CRITICAL ISSUES IDENTIFIED', 'IMMEDIATE ACTIONS REQUIRED',
    'CLIENT CONCERNS', 'SOLICITOR RECOMMENDATIONS', 'MATTER SUMMARY',
    'OUTSTANDING ACTION ITEMS', 'IMPORTANT DATES', 'SUGGESTED AGENDA ITEMS',
    'CLIENT CONFIRMATION', 'INTRODUCTION', 'BACKGROUND', 'SUMMARY',
    'CONCLUSION', 'ASSETS SUMMARY', 'DISCUSSION POINTS', 'ACTION ITEMS',
    'DECISIONS MADE', 'PURPOSE OF MEETING', 'ADDITIONAL NOTES',
    'Attendance Note', 'Meeting Summary', 'Matters Discussed', 'Next Steps',
    'Key Points', 'Critical Issues Identified', 'Immediate Actions Required',
    'Client Concerns', 'Solicitor Recommendations', 'Matter Summary',
    'Outstanding Action Items', 'Important Dates', 'Suggested Agenda Items',
    'Client Confirmation', 'Introduction', 'Background', 'Summary',
    'Conclusion', 'Assets Summary', 'Discussion Points', 'Action Items',
    'Decisions Made', 'Purpose of Meeting', 'Additional Notes',
    'Key Discussion Points from Previous Meeting',
  ];
  
  let result = content;
  for (const heading of knownHeadings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numberedPattern = new RegExp(`^(\\d+\\.)\\s+(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`, 'gm');
    result = result.replace(numberedPattern, `$1 **${heading}**$2`);
    const standalonePattern = new RegExp(`^(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`, 'gm');
    result = result.replace(standalonePattern, `**${heading}**$1`);
  }
  return result;
}

const LEGAL_AUTOCOMPLETE_PHRASES = [
  'without prejudice',
  'without prejudice save as to costs',
  'pursuant to',
  'time is of the essence',
  'notwithstanding',
  'in consideration of',
  'subject to contract',
  'subject to the terms and conditions',
  'in full and final settlement',
  'reasonable endeavours',
  'best endeavours',
  'force majeure',
  'mutually agreed',
  'inter alia',
  'prima facie',
  'pro rata',
  'as agreed between the parties',
  'on a without admission basis',
  'subject to board approval',
  'on the balance of probabilities',
];

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  focusMode?: boolean;
  onFocusModeToggle?: () => void;
  zoom?: number;
}

export function RichTextEditor({ 
  content, onChange, disabled, placeholder, focusMode, onFocusModeToggle, zoom = 100 
}: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Start typing...' }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight.configure({ multicolor: false }),
      Superscript,
      Subscript,
      CharacterCount,
    ],
    content: '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 text-foreground',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      const markdown = editor.storage.markdown.getMarkdown();
      onChange(markdown);

      // Legal autocomplete
      const { from } = editor.state.selection;
      const text = editor.state.doc.textBetween(Math.max(0, from - 30), from);
      const lastWord = text.split(/\s/).pop()?.toLowerCase() || '';
      if (lastWord.length >= 3) {
        const matches = LEGAL_AUTOCOMPLETE_PHRASES.filter(p => 
          p.toLowerCase().startsWith(lastWord) && p.toLowerCase() !== lastWord
        );
        if (matches.length > 0) {
          setAutocompleteOptions(matches.slice(0, 5));
          setAutocompleteVisible(true);
          setSelectedOption(0);
        } else {
          setAutocompleteVisible(false);
        }
      } else {
        setAutocompleteVisible(false);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentMarkdown = editor.storage.markdown?.getMarkdown() ?? '';
    if (content === currentMarkdown) return;
    isUpdatingRef.current = true;
    try {
      const processedContent = ensureBoldHeadings(content ?? '');
      const doc = editor.storage.markdown.parser.parse(processedContent).toJSON();
      editor.commands.setContent(doc, false);
    } catch (err) {
      console.error('[RichTextEditor] Markdown hydration failed, falling back to raw:', err);
      editor.commands.setContent(content ?? '', false);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [editor, content]);

  useEffect(() => {
    if (editor && disabled !== undefined) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  const applyAutocomplete = useCallback((phrase: string) => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const text = editor.state.doc.textBetween(Math.max(0, from - 30), from);
    const lastWord = text.split(/\s/).pop() || '';
    editor.chain().focus()
      .deleteRange({ from: from - lastWord.length, to: from })
      .insertContent(phrase + ' ')
      .run();
    setAutocompleteVisible(false);
  }, [editor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!autocompleteVisible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedOption(p => Math.min(p + 1, autocompleteOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedOption(p => Math.max(p - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (autocompleteOptions[selectedOption]) {
        e.preventDefault();
        applyAutocomplete(autocompleteOptions[selectedOption]);
      }
    } else if (e.key === 'Escape') {
      setAutocompleteVisible(false);
    }
  }, [autocompleteVisible, autocompleteOptions, selectedOption, applyAutocomplete]);

  const handleSearch = useCallback(() => {
    if (!editor || !searchTerm) return;
    // Simple text search - highlight all occurrences
    const content = editor.getHTML();
    const highlighted = content.replace(
      new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      match => `<mark>${match}</mark>`
    );
    editor.commands.setContent(highlighted);
  }, [editor, searchTerm]);

  const handleReplace = useCallback(() => {
    if (!editor || !searchTerm) return;
    const text = editor.getText();
    if (text.includes(searchTerm)) {
      const html = editor.getHTML();
      const replaced = html.replace(
        new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        replaceTerm
      );
      editor.commands.setContent(replaced);
    }
  }, [editor, searchTerm, replaceTerm]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  const wordCount = editor.storage.characterCount?.words() ?? 0;
  const charCount = editor.storage.characterCount?.characters() ?? 0;

  const ToolbarButton = ({ 
    onClick, active, icon: Icon, tooltip, disabled: btnDisabled 
  }: { 
    onClick: () => void; active?: boolean; icon: any; tooltip: string; disabled?: boolean 
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={active ? 'secondary' : 'ghost'}
          onClick={onClick}
          disabled={btnDisabled ?? disabled}
          className="h-8 w-8"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );

  const Sep = () => <div className="w-px h-6 bg-border mx-1" />;

  return (
    <div 
      className={`rounded-md overflow-hidden ${disabled ? 'bg-muted/20' : 'border border-input bg-background'}`}
      style={{ fontSize: `${zoom}%` }}
    >
      {!disabled && (
        <div className="border-b border-border bg-muted/30">
          {/* Primary toolbar */}
          <div className="flex items-center gap-0.5 p-1.5 flex-wrap">
            {/* Text formatting */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} tooltip="Bold (Ctrl+B)" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} tooltip="Italic (Ctrl+I)" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} tooltip="Underline (Ctrl+U)" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} icon={Highlighter} tooltip="Highlight" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} icon={SuperscriptIcon} tooltip="Superscript" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} icon={SubscriptIcon} tooltip="Subscript" />

            <Sep />

            {/* Headings */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} tooltip="Heading 1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading2} tooltip="Heading 2" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={Heading3} tooltip="Heading 3" />

            <Sep />

            {/* Lists */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} tooltip="Bullet List" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} tooltip="Numbered List" />

            <Sep />

            {/* Alignment */}
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} icon={AlignLeft} tooltip="Align Left" />
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} icon={AlignCenter} tooltip="Align Centre" />
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} icon={AlignRight} tooltip="Align Right" />
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} icon={AlignJustify} tooltip="Justify" />

            <Sep />

            {/* Tools */}
            <ToolbarButton onClick={insertTable} active={false} icon={TableIcon} tooltip="Insert Table" />
            <ToolbarButton onClick={() => setShowSearch(s => !s)} active={showSearch} icon={Search} tooltip="Find & Replace" />

            {onFocusModeToggle && (
              <>
                <Sep />
                <ToolbarButton 
                  onClick={onFocusModeToggle} 
                  active={focusMode} 
                  icon={focusMode ? Minimize2 : Maximize2} 
                  tooltip={focusMode ? "Exit Focus Mode (Esc)" : "Focus Mode"} 
                />
              </>
            )}
          </div>

          {/* Find & Replace bar */}
          {showSearch && (
            <div className="flex items-center gap-2 px-2 pb-2 flex-wrap">
              <Input
                placeholder="Find..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-7 text-xs w-36"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Input
                placeholder="Replace with..."
                value={replaceTerm}
                onChange={e => setReplaceTerm(e.target.value)}
                className="h-7 text-xs w-36"
              />
              <Button size="sm" variant="outline" onClick={handleSearch} className="h-7 text-xs px-2">Find</Button>
              <Button size="sm" variant="outline" onClick={handleReplace} className="h-7 text-xs px-2">Replace All</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSearch(false)} className="h-7 text-xs px-2">Close</Button>
            </div>
          )}
        </div>
      )}

      <div className="relative" onKeyDown={handleKeyDown}>
        <EditorContent 
          editor={editor} 
          className="[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-4 [&_.ProseMirror]:focus:outline-none
            [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:mt-4
            [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-3
            [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-2
            [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p]:leading-relaxed
            [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-2
            [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-2
            [&_.ProseMirror_li]:mb-1
            [&_.ProseMirror_strong]:font-bold
            [&_.ProseMirror_em]:italic
            [&_.ProseMirror_u]:underline
            [&_.ProseMirror_mark]:bg-yellow-200 [&_.ProseMirror_mark]:dark:bg-yellow-800
            [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-3
            [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:text-sm
            [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:bg-muted/40 [&_.ProseMirror_th]:text-sm
            [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground
            [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
            [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left
            [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none
            [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0"
          data-testid="editor-rich-text"
        />

        {/* Legal autocomplete dropdown */}
        {autocompleteVisible && autocompleteOptions.length > 0 && (
          <div className="absolute z-50 left-4 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden"
            style={{ top: '2.5rem' }}
          >
            {autocompleteOptions.map((opt, i) => (
              <button
                key={opt}
                className={`w-full text-left px-3 py-1.5 text-sm ${i === selectedOption ? 'bg-accent text-accent-foreground' : 'hover-elevate'}`}
                onMouseDown={e => { e.preventDefault(); applyAutocomplete(opt); }}
              >
                {opt}
              </button>
            ))}
            <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border">
              Tab to complete
            </div>
          </div>
        )}
      </div>

      {/* Footer: word count */}
      {!disabled && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Type className="w-3 h-3" />
            <span>{wordCount} words</span>
            <span className="ml-2">{charCount} characters</span>
          </div>
        </div>
      )}
    </div>
  );
}
