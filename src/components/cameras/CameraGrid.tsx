'use client';
// SPDX-License-Identifier: MIT


import { CameraCard } from './CameraCard';
import type { Camera } from '@/types/models';

interface CameraGridProps {
  cameras: Camera[];
  isLoading?: boolean;
}

export function CameraGrid({ cameras, isLoading }: CameraGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="aspect-video rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[var(--surface)] border border-[var(--border)] border-dashed rounded-xl">
        <p className="text-[var(--text-muted)]">No cameras found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cameras.map((camera) => (
        <CameraCard key={camera.id} camera={camera} />
      ))}
    </div>
  );
}
