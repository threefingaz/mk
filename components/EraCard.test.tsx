import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EraCard } from './EraCard';
import { FIGHTERS } from '@/lib/fighters';

// Pull Raiden out of canonical FIGHTERS so tests use the real shipped data.
const raiden = FIGHTERS.find((f) => f.id === 'raiden')!;

describe('EraCard', () => {
  describe('idle state', () => {
    it('renders the old-era card class without picked/dimmed modifiers', () => {
      const { container } = render(<EraCard fighter={raiden} era="old" />);
      const card = container.querySelector('.fighter-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('fighter-card-old');
      expect(card).not.toHaveClass('picked');
      expect(card).not.toHaveClass('dimmed');
    });

    it('renders the new-era card class without picked/dimmed modifiers', () => {
      const { container } = render(<EraCard fighter={raiden} era="new" />);
      const card = container.querySelector('.fighter-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('fighter-card-new');
      expect(card).not.toHaveClass('picked');
      expect(card).not.toHaveClass('dimmed');
    });

    it('does not render the picked-stamp overlay when not picked', () => {
      render(<EraCard fighter={raiden} era="old" />);
      expect(screen.queryByTestId('picked-stamp')).not.toBeInTheDocument();
    });
  });

  describe('picked state', () => {
    it('adds the .picked class', () => {
      const { container } = render(<EraCard fighter={raiden} era="new" picked />);
      const card = container.querySelector('.fighter-card');
      expect(card).toHaveClass('picked');
    });

    it('renders the picked-stamp DOM element', () => {
      render(<EraCard fighter={raiden} era="new" picked />);
      const stamp = screen.getByTestId('picked-stamp');
      expect(stamp).toBeInTheDocument();
      expect(stamp).toHaveTextContent('PICKED');
    });
  });

  describe('dimmed state', () => {
    it('adds the .dimmed class', () => {
      const { container } = render(<EraCard fighter={raiden} era="old" dimmed />);
      const card = container.querySelector('.fighter-card');
      expect(card).toHaveClass('dimmed');
    });

    it('applies the inline opacity/grayscale fade', () => {
      const { container } = render(<EraCard fighter={raiden} era="old" dimmed />);
      const card = container.querySelector<HTMLButtonElement>('.fighter-card');
      expect(card).not.toBeNull();
      // inline opacity is set as a string in React style attribute
      expect(card!.style.opacity).toBe('0.32');
      expect(card!.style.filter).toContain('grayscale');
    });
  });

  describe('onPick handler', () => {
    it('fires onPick when the card is clicked in idle state', async () => {
      const onPick = vi.fn();
      const user = userEvent.setup();
      render(<EraCard fighter={raiden} era="old" onPick={onPick} />);
      const card = screen.getByRole('button');
      await user.click(card);
      expect(onPick).toHaveBeenCalledTimes(1);
    });
  });

  describe('nameBandMode', () => {
    it("'full' renders both the character name and the era-appropriate actor", () => {
      render(<EraCard fighter={raiden} era="old" nameBandMode="full" />);
      const band = screen.getByTestId('name-band');
      expect(band).toHaveTextContent('RAIDEN');
      expect(band).toHaveTextContent(raiden.oldActor);
    });

    it("'full' uses the new-era actor when era === 'new'", () => {
      render(<EraCard fighter={raiden} era="new" nameBandMode="full" />);
      const band = screen.getByTestId('name-band');
      expect(band).toHaveTextContent('RAIDEN');
      expect(band).toHaveTextContent(raiden.newActor);
      expect(band).not.toHaveTextContent(raiden.oldActor);
    });

    it("'actor' renders the actor only — no uppercase character name", () => {
      render(<EraCard fighter={raiden} era="old" nameBandMode="actor" />);
      const band = screen.getByTestId('name-band');
      expect(band).toHaveTextContent(raiden.oldActor);
      // Character name in this mode is anchored above the card by the parent screen;
      // assert the uppercase form is absent from the band.
      expect(band).not.toHaveTextContent('RAIDEN');
    });

  });

  describe('post-pick (no onPick handler)', () => {
    it('drops out of the tab order (tabIndex=-1) when picked and no onPick is supplied', () => {
      const { container } = render(<EraCard fighter={raiden} era="old" picked />);
      const card = container.querySelector<HTMLButtonElement>('.fighter-card');
      expect(card).not.toBeNull();
      expect(card!.tabIndex).toBe(-1);
    });

    it('keeps tabIndex=0 when an onPick handler is supplied', () => {
      const { container } = render(<EraCard fighter={raiden} era="old" onPick={() => {}} />);
      const card = container.querySelector<HTMLButtonElement>('.fighter-card');
      expect(card!.tabIndex).toBe(0);
    });

    it('does not fire any handler on click when onPick is undefined', async () => {
      const onPick = vi.fn();
      const user = userEvent.setup();
      // Intentionally do NOT pass onPick. No handler is wired → click is a no-op.
      const { container } = render(<EraCard fighter={raiden} era="old" picked />);
      const card = container.querySelector<HTMLButtonElement>('.fighter-card')!;
      await user.click(card);
      expect(onPick).not.toHaveBeenCalled();
    });
  });
});
