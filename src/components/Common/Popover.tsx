import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type PopoverAlign = 'left' | 'center' | 'right';
export type PopoverSide = 'top' | 'bottom';

interface PopoverProps {
  /** Element rendered as the trigger button. The Popover wraps it in a button. */
  trigger: ReactNode;
  /** Content rendered inside the popover panel when open. */
  children: ReactNode;
  /** Horizontal alignment of the panel relative to the trigger. Default: 'center'. */
  align?: PopoverAlign;
  /** Side of the trigger the panel appears on. Default: 'bottom'. */
  side?: PopoverSide;
  /** Optional aria-label for the trigger button (required if trigger has no text). */
  triggerAriaLabel?: string;
  /** Optional className applied to the trigger button. */
  triggerClassName?: string;
  /** Optional className applied to the popover panel. */
  panelClassName?: string;
  /** Disables the trigger and prevents opening. */
  disabled?: boolean;
}

/**
 * Anchored popover panel. Opens on trigger click, closes on outside click or Escape.
 * Returns focus to the trigger when closed.
 *
 * Positioning is CSS-based (absolute, relative to the wrapper) — no viewport-edge
 * detection in this version. Suitable for popovers in stable toolbar positions.
 */
export function Popover({
  trigger,
  children,
  align = 'center',
  side = 'bottom',
  triggerAriaLabel,
  triggerClassName,
  panelClassName,
  disabled = false,
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  // Close on Escape and return focus to trigger
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleTriggerClick = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const panelPositionClasses = [
    side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
    align === 'left' ? 'left-0' : '',
    align === 'right' ? 'right-0' : '',
    align === 'center' ? 'left-1/2 -translate-x-1/2' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={triggerAriaLabel}
        disabled={disabled}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          className={`absolute z-50 ${panelPositionClasses} ${panelClassName ?? ''}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}