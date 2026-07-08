import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useClickOutside } from './useClickOutside';

function setup(enabled: boolean) {
  const inside = document.createElement('div');
  const outside = document.createElement('div');
  document.body.append(inside, outside);
  const ref = { current: inside } as RefObject<HTMLDivElement>;
  const cb = vi.fn();
  renderHook(() => useClickOutside(ref, cb, enabled));
  return { inside, outside, cb };
}

function mousedown(el: Element) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

describe('useClickOutside', () => {
  it('fires on an outside click', () => {
    const { outside, cb } = setup(true);
    mousedown(outside);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('ignores clicks inside the element', () => {
    const { inside, cb } = setup(true);
    mousedown(inside);
    expect(cb).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const { outside, cb } = setup(false);
    mousedown(outside);
    expect(cb).not.toHaveBeenCalled();
  });
});
