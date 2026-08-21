import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { PutWhereItBelongsToast } from '../components/PutWhereItBelongsToast';
import { BookmarkCard } from '../components/BookmarkCard';
import { Bookmark, ClipRecommendationItem } from '../types';

const mockBookmark: Bookmark = {
  id: 42,
  user_id: 1,
  url: 'slip://note/42',
  title: '₹720/kg, MOQ 300kg, FOB Chennai',
  description: 'Supplier bulk pricing for PLA high flow spools',
  content_type: 'note',
  created_at: '2026-08-21T09:00:00Z',
  updated_at: '2026-08-21T09:00:00Z',
  tags: [{ id: 1, name: 'supplier' }, { id: 2, name: 'pla' }]
};

const mockRecommendations: ClipRecommendationItem[] = [
  {
    clipId: 12,
    name: 'China',
    breadcrumbs: ['Filamint', 'Suppliers', 'China'],
    path: 'Filamint → Suppliers → China',
    confidence: 94,
    reason: 'Based on 4 similar Slips · matching supplier, PLA'
  },
  {
    clipId: 15,
    name: 'Materials',
    breadcrumbs: ['Hobbies', '3D Printing', 'Materials'],
    path: 'Hobbies → 3D Printing → Materials',
    confidence: 72,
    reason: 'Contains 8 3D printing filament slips and guides'
  }
];

describe('PutWhereItBelongsToast UI Component (Suggested Clip)', () => {
  it('renders primary recommendation with path, evidence reason, and action buttons', () => {
    const handleMove = vi.fn().mockResolvedValue(undefined);
    const handleChooseAnother = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <PutWhereItBelongsToast
        bookmark={mockBookmark}
        recommendations={mockRecommendations}
        onMoveToClip={handleMove}
        onChooseAnother={handleChooseAnother}
        onDismiss={handleDismiss}
      />
    );

    expect(screen.getByText('Suggested Clip')).toBeInTheDocument();
    expect(screen.getByText('₹720/kg, MOQ 300kg, FOB Chennai')).toBeInTheDocument();
    expect(screen.getByText('Filamint → Suppliers → China')).toBeInTheDocument();
    expect(screen.getByText('Based on 4 similar Slips · matching supplier, PLA')).toBeInTheDocument();
    expect(screen.getByText('94% match')).toBeInTheDocument();

    // Check actions
    expect(screen.getByRole('button', { name: /move to clip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose another clip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss recommendation/i })).toBeInTheDocument();
  });

  it('displays queue counter badge when multiple items are in queue', () => {
    const handleMove = vi.fn().mockResolvedValue(undefined);
    const handleChooseAnother = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <PutWhereItBelongsToast
        bookmark={mockBookmark}
        recommendations={mockRecommendations}
        queueIndex={1}
        queueTotal={3}
        onMoveToClip={handleMove}
        onChooseAnother={handleChooseAnother}
        onDismiss={handleDismiss}
      />
    );

    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('allows switching between multiple alternative candidate clips', () => {
    const handleMove = vi.fn().mockResolvedValue(undefined);
    const handleChooseAnother = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <PutWhereItBelongsToast
        bookmark={mockBookmark}
        recommendations={mockRecommendations}
        onMoveToClip={handleMove}
        onChooseAnother={handleChooseAnother}
        onDismiss={handleDismiss}
      />
    );

    expect(screen.getByText('Filamint → Suppliers → China')).toBeInTheDocument();

    // Click alternative pill "Materials"
    const altPill = screen.getByRole('button', { name: /materials/i });
    fireEvent.click(altPill);

    expect(screen.getByText('Hobbies → 3D Printing → Materials')).toBeInTheDocument();
    expect(screen.getByText('Contains 8 3D printing filament slips and guides')).toBeInTheDocument();
    expect(screen.getByText('72% match')).toBeInTheDocument();
  });

  it('calls onMoveToClip when user clicks [Move to Clip] button', async () => {
    const handleMove = vi.fn().mockResolvedValue(undefined);
    const handleChooseAnother = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <PutWhereItBelongsToast
        bookmark={mockBookmark}
        recommendations={mockRecommendations}
        onMoveToClip={handleMove}
        onChooseAnother={handleChooseAnother}
        onDismiss={handleDismiss}
      />
    );

    const moveBtn = screen.getByRole('button', { name: /move to clip/i });
    fireEvent.click(moveBtn);

    expect(handleMove).toHaveBeenCalledWith(42, 12, 'Filamint → Suppliers → China');
  });

  it('calls onChooseAnother when user clicks [Choose another Clip]', () => {
    const handleMove = vi.fn().mockResolvedValue(undefined);
    const handleChooseAnother = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <PutWhereItBelongsToast
        bookmark={mockBookmark}
        recommendations={mockRecommendations}
        onMoveToClip={handleMove}
        onChooseAnother={handleChooseAnother}
        onDismiss={handleDismiss}
      />
    );

    const chooseBtn = screen.getByRole('button', { name: /choose another clip/i });
    fireEvent.click(chooseBtn);

    expect(handleDismiss).not.toHaveBeenCalled();
    expect(handleChooseAnother).toHaveBeenCalledWith(mockBookmark);
  });

  it('displays fallback message when no strong match is found', () => {
    const handleMove = vi.fn().mockResolvedValue(undefined);
    const handleChooseAnother = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <PutWhereItBelongsToast
        bookmark={mockBookmark}
        recommendations={[]}
        onMoveToClip={handleMove}
        onChooseAnother={handleChooseAnother}
        onDismiss={handleDismiss}
      />
    );

    expect(screen.getByText("Couldn't find a strong clip suggestion for this Slip.")).toBeInTheDocument();
    expect(screen.getByText('Organize manually in Clip')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Organize manually in Clip'));
    expect(handleDismiss).not.toHaveBeenCalled();
    expect(handleChooseAnother).toHaveBeenCalledWith(mockBookmark);
  });
});

describe('BookmarkCard "Suggest Clip with AI" Action', () => {
  it('renders "Suggest Clip with AI" in dropdown menu when AI is connected', () => {
    const handleRecommendClip = vi.fn();
    const handleManageClips = vi.fn();

    render(
      <BookmarkCard
        bookmark={mockBookmark}
        isAIConnected={true}
        onManageClips={handleManageClips}
        onRecommendClip={handleRecommendClip}
      />
    );

    // Open more menu
    const moreBtn = screen.getByLabelText('More actions');
    fireEvent.click(moreBtn);

    expect(screen.getByText('Suggest Clip with AI')).toBeInTheDocument();
    expect(screen.getByText('Organize in Clip')).toBeInTheDocument();

    // Click "Suggest Clip with AI"
    fireEvent.click(screen.getByText('Suggest Clip with AI'));
    expect(handleRecommendClip).toHaveBeenCalledWith(mockBookmark);
  });

  it('does NOT render "Suggest Clip with AI" when AI is not connected', () => {
    const handleRecommendClip = vi.fn();
    const handleManageClips = vi.fn();

    render(
      <BookmarkCard
        bookmark={mockBookmark}
        isAIConnected={false}
        onManageClips={handleManageClips}
        onRecommendClip={handleRecommendClip}
      />
    );

    // Open more menu
    const moreBtn = screen.getByLabelText('More actions');
    fireEvent.click(moreBtn);

    expect(screen.queryByText('Suggest Clip with AI')).not.toBeInTheDocument();
    expect(screen.getByText('Organize in Clip')).toBeInTheDocument();
  });
});
