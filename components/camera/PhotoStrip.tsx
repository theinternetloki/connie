"use client";

interface PhotoStripProps {
  photos: Array<{ id: string; url: string; label: string }>;
  onPhotoClick?: (index: number) => void;
}

export function PhotoStrip({ photos, onPhotoClick }: PhotoStripProps) {
  if (photos.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-200 cursor-pointer"
          onClick={() => onPhotoClick?.(index)}
        >
          <img
            src={photo.url}
            alt={photo.label}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
