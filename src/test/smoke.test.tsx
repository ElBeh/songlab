// Smoke test: proves the Vitest + React Testing Library harness renders
// a component and that jest-dom matchers are available.
// Placeholder — replaced by real characterization tests in later phases.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello({ name }: { name: string }) {
  return <p>Hello, {name}</p>;
}

describe('test harness', () => {
  it('renders a React component', () => {
    render(<Hello name="SongLab" />);
    expect(screen.getByText('Hello, SongLab')).toBeInTheDocument();
  });
});
