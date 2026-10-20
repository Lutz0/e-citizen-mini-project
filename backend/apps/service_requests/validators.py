"""Image-upload validation and sanitisation.

Defence in depth - a file is only accepted if *every* layer agrees:

1. it is non-empty and within the size limit;
2. the file extension is on an allow-list;
3. the declared ``Content-Type`` is on an allow-list;
4. the bytes really decode as an image of an allowed format (JPEG/PNG/WebP),
   and the format matches the extension;
5. the pixel count is bounded (decompression-bomb protection).

Accepted images are then **re-encoded** with Pillow and stored under a random
name. Re-encoding discards EXIF/GPS metadata (a privacy risk for citizens
photographing their own street), and removes anything appended to or hidden
inside the original file (polyglots, scripts in metadata chunks).
"""
import io
import os
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

# Pillow format name -> (canonical extension, accepted file extensions, MIME type)
ALLOWED_FORMATS = {
    "JPEG": ("jpg", {".jpg", ".jpeg"}, "image/jpeg"),
    "PNG": ("png", {".png"}, "image/png"),
    "WEBP": ("webp", {".webp"}, "image/webp"),
}
ALLOWED_EXTENSIONS = {ext for _, exts, _ in ALLOWED_FORMATS.values() for ext in exts}
ALLOWED_CONTENT_TYPES = {mime for _, _, mime in ALLOWED_FORMATS.values()}

UNSUPPORTED_MESSAGE = "Unsupported file type. Please upload a JPEG, PNG or WebP image."


def _max_megabytes():
    return settings.IMAGE_MAX_UPLOAD_BYTES / (1024 * 1024)


def validate_and_sanitize_image(upload):
    """Validate an uploaded file and return a sanitised, re-encoded ``ContentFile``.

    Raises ``django.core.exceptions.ValidationError`` with a user-friendly
    message if the upload is rejected.
    """
    size = getattr(upload, "size", None)
    if not size:
        raise ValidationError("The uploaded file is empty.")
    if size > settings.IMAGE_MAX_UPLOAD_BYTES:
        raise ValidationError(f"The image is too large. The maximum size is {_max_megabytes():g} MB.")

    extension = os.path.splitext(upload.name or "")[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValidationError(UNSUPPORTED_MESSAGE)

    content_type = (getattr(upload, "content_type", "") or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(UNSUPPORTED_MESSAGE)

    try:
        upload.seek(0)
        with Image.open(upload) as probe:
            image_format = probe.format
            width, height = probe.size
            if image_format not in ALLOWED_FORMATS:
                raise ValidationError(UNSUPPORTED_MESSAGE)
            if extension not in ALLOWED_FORMATS[image_format][1]:
                raise ValidationError("The file extension does not match the image content.")
            if width * height > settings.IMAGE_MAX_PIXELS:
                raise ValidationError("The image dimensions are too large. Please upload a smaller photo.")

            # Fully decode: catches truncated/corrupt files that only look valid in the header.
            probe.load()
            image = ImageOps.exif_transpose(probe)  # honour phone-camera rotation before stripping EXIF
            image.thumbnail((settings.IMAGE_MAX_DIMENSION, settings.IMAGE_MAX_DIMENSION))
            return _encode(image, image_format)
    except ValidationError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError, EOFError):
        raise ValidationError("The file is not a valid image or is corrupted.")
    finally:
        try:
            upload.seek(0)
        except (ValueError, OSError):
            pass


def _encode(image, image_format):
    """Re-encode ``image`` into a fresh file (no metadata carried over)."""
    canonical_extension = ALLOWED_FORMATS[image_format][0]
    buffer = io.BytesIO()

    if image_format == "JPEG":
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.save(buffer, format="JPEG", quality=85, optimize=True)
    elif image_format == "PNG":
        image.save(buffer, format="PNG", optimize=True)
    else:  # WEBP
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        image.save(buffer, format="WEBP", quality=85)

    return ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.{canonical_extension}")
