"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2, Star } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface ProductImageUploadProps {
  productId: string;
  images: ProductImage[];
  onImagesChange: () => void;
}

export function ProductImageUpload({
  productId,
  images,
  onImagesChange,
}: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", productId);
      formData.append("isPrimary", images.length === 0 ? "true" : "false");

      const res = await fetch("/api/upload", { method: "POST", body: formData });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Upload failed");
      }
    }

    setUploading(false);
    onImagesChange();
    // Reset input
    e.target.value = "";
  }

  async function handleDelete(imageId: string) {
    // For now, just remove from database (file stays on disk)
    await fetch(`/api/upload?id=${imageId}`, { method: "DELETE" });
    onImagesChange();
  }

  async function handleSetPrimary(imageId: string) {
    await fetch("/api/upload", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: imageId, productId }),
    });
    onImagesChange();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById("product-image-input")?.click()}
        >
          <ImagePlus className="mr-1 h-4 w-4" />
          {uploading ? "Uploading..." : "Add Images"}
        </Button>
        <input
          id="product-image-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <span className="text-xs text-gray-500">JPEG, PNG, WebP (max 5MB)</span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group rounded-md border overflow-hidden aspect-square"
            >
              <Image
                src={img.url}
                alt="Product"
                fill
                className="object-cover"
                sizes="150px"
              />
              {img.isPrimary && (
                <span className="absolute top-1 left-1 bg-yellow-400 text-xs px-1.5 py-0.5 rounded font-medium">
                  Primary
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.isPrimary && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSetPrimary(img.id)}
                  >
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(img.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
