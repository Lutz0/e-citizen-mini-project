"""Image upload validation: valid images are stored safely, everything else is rejected."""
import io
import os

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

from apps.core.testing import (
    REQUEST_PAYLOAD,
    BaseAPITestCase,
    image_bytes,
    image_upload,
    make_admin,
    make_citizen,
    read_streamed,
)
from apps.service_requests.models import ServiceRequest

URL = "/api/requests/"


class ImageTestCase(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.citizen = make_citizen()
        self.client.force_login(self.citizen)

    def submit(self, upload):
        return self.client.post(URL, {**REQUEST_PAYLOAD, "image": upload}, format="multipart")

    def assertImageRejected(self, upload, message_fragment=None):
        response = self.submit(upload)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("image", response.data["errors"])
        if message_fragment:
            self.assertIn(message_fragment, response.data["errors"]["image"][0])
        self.assertEqual(ServiceRequest.objects.count(), 0, "a rejected upload must not create a request")
        self.assertEqual(self.stored_files(), [], "a rejected upload must not leave a file on disk")
        return response

    def stored_files(self):
        from django.conf import settings

        found = []
        for root, _, files in os.walk(settings.MEDIA_ROOT):
            found += [os.path.join(root, f) for f in files]
        return found


class AcceptedImageTests(ImageTestCase):
    def test_png_jpeg_and_webp_are_accepted(self):
        for name, fmt in (("a.png", "PNG"), ("b.jpg", "JPEG"), ("c.jpeg", "JPEG"), ("d.webp", "WEBP")):
            with self.subTest(name=name):
                response = self.submit(image_upload(name, fmt))
                self.assertEqual(response.status_code, 201, response.data)
                self.assertTrue(response.data["has_image"])

    def test_extension_check_is_case_insensitive(self):
        self.assertEqual(self.submit(image_upload("PHOTO.JPG", "JPEG")).status_code, 201)

    def test_image_is_stored_under_a_random_name_not_the_clients(self):
        response = self.submit(image_upload("../../evil name.png", "PNG"))
        self.assertEqual(response.status_code, 201)
        stored = ServiceRequest.objects.get(reference=response.data["reference"]).image.name
        self.assertRegex(stored, r"^service_requests/\d{4}/\d{2}/[0-9a-f]{32}\.png$")
        self.assertNotIn("evil", stored)

    def test_owner_and_admin_can_view_the_image_with_correct_content_type(self):
        response = self.submit(image_upload("a.jpg", "JPEG"))
        url = f"{URL}{response.data['reference']}/image/"

        owner = self.client.get(url)
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner["Content-Type"], "image/jpeg")
        self.assertEqual(owner["X-Content-Type-Options"], "nosniff")
        self.assertIn("private", owner["Cache-Control"])
        self.assertTrue(read_streamed(owner).startswith(b"\xff\xd8"), "body is the JPEG bytes")

        self.client.force_login(make_admin())
        admin = self.client.get(url)
        self.assertEqual(admin.status_code, 200)
        read_streamed(admin)

    def test_request_without_an_image_has_no_image_endpoint(self):
        response = self.client.post(URL, REQUEST_PAYLOAD)
        self.assertFalse(response.data["has_image"])
        self.assertEqual(self.client.get(f"{URL}{response.data['reference']}/image/").status_code, 404)

    def test_exif_metadata_is_stripped_and_orientation_applied(self):
        exif = Image.Exif()
        exif[0x010F] = "SecretCameraMaker"  # Make
        exif[0x0112] = 6  # Orientation: rotate 90 degrees
        upload = image_upload("phone.jpg", "JPEG", size=(80, 40), exif=exif)

        response = self.submit(upload)
        self.assertEqual(response.status_code, 201, response.data)

        stored = ServiceRequest.objects.get(reference=response.data["reference"])
        with stored.image.open("rb") as handle:
            raw = handle.read()
        self.assertNotIn(b"SecretCameraMaker", raw)
        image = Image.open(io.BytesIO(raw))
        self.assertEqual(len(image.getexif()), 0)
        self.assertEqual(image.size, (40, 80), "orientation must be baked in before metadata is dropped")

    def test_large_photos_are_downscaled(self):
        with override_settings(IMAGE_MAX_DIMENSION=100):
            response = self.submit(image_upload("big.png", "PNG", size=(400, 200)))
        stored = ServiceRequest.objects.get(reference=response.data["reference"])
        with stored.image.open("rb") as handle:
            self.assertEqual(Image.open(handle).size, (100, 50))

    def test_data_appended_to_a_valid_image_is_not_preserved(self):
        payload = b"<?php system($_GET['c']); ?>"
        upload = image_upload("shell.png", "PNG", data=image_bytes("PNG") + payload)

        response = self.submit(upload)
        self.assertEqual(response.status_code, 201)
        stored = ServiceRequest.objects.get(reference=response.data["reference"])
        with stored.image.open("rb") as handle:
            self.assertNotIn(payload, handle.read())


class RejectedImageTests(ImageTestCase):
    def test_text_file_renamed_to_png_is_rejected(self):
        upload = SimpleUploadedFile("photo.png", b"just some text, not a picture", content_type="image/png")
        self.assertImageRejected(upload, "not a valid image")

    def test_html_and_script_payloads_disguised_as_images_are_rejected(self):
        for body in (b"<script>alert(1)</script>", b"<html><body>hi</body></html>", b"<?php echo 1; ?>"):
            with self.subTest(body=body):
                self.assertImageRejected(SimpleUploadedFile("x.jpg", body, content_type="image/jpeg"))

    def test_unsupported_extensions_are_rejected(self):
        for name in ("photo.gif", "photo.bmp", "photo.svg", "photo.pdf", "photo.exe", "photo.php", "photo.html", "photo"):
            with self.subTest(name=name):
                self.assertImageRejected(
                    SimpleUploadedFile(name, image_bytes("PNG"), content_type="image/png"), "Unsupported file type"
                )

    def test_svg_images_are_rejected(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        self.assertImageRejected(SimpleUploadedFile("logo.svg", svg, content_type="image/svg+xml"), "Unsupported")

    def test_gif_content_is_rejected_even_with_an_allowed_extension(self):
        upload = image_upload("sneaky.png", "GIF", content_type="image/png")
        self.assertImageRejected(upload, "Unsupported file type")

    def test_extension_must_match_the_real_format(self):
        upload = image_upload("actually-jpeg.png", "JPEG", content_type="image/png")
        self.assertImageRejected(upload, "does not match")

    def test_disallowed_declared_content_type_is_rejected(self):
        for content_type in ("text/html", "application/octet-stream", "image/svg+xml", "application/x-php"):
            with self.subTest(content_type=content_type):
                self.assertImageRejected(image_upload("a.png", "PNG", content_type=content_type), "Unsupported")

    def test_empty_file_is_rejected(self):
        self.assertImageRejected(SimpleUploadedFile("empty.png", b"", content_type="image/png"))

    def test_oversized_file_is_rejected(self):
        with override_settings(IMAGE_MAX_UPLOAD_BYTES=1024):
            self.assertImageRejected(
                image_upload("big.png", "PNG", size=(300, 300), data=os.urandom(5000)), "too large"
            )

    def test_upload_far_beyond_the_limit_is_refused_before_it_is_read(self):
        # Rejected on the declared Content-Length alone, so a huge body never has to be received or parsed.
        with override_settings(IMAGE_MAX_UPLOAD_BYTES=1024):
            response = self.submit(
                SimpleUploadedFile("huge.png", b"x" * (400 * 1024), content_type="image/png")
            )
        self.assertEqual(response.status_code, 413, response.data)
        self.assertEqual(response.data["code"], "payload_too_large")
        self.assertEqual(ServiceRequest.objects.count(), 0)
        self.assertEqual(self.stored_files(), [])

    def test_a_file_just_under_the_limit_is_accepted(self):
        upload = image_upload("ok.png", "PNG")
        with override_settings(IMAGE_MAX_UPLOAD_BYTES=upload.size + 1):
            self.assertEqual(self.submit(upload).status_code, 201)

    def test_truncated_image_is_rejected(self):
        data = image_bytes("PNG", size=(200, 200))
        self.assertImageRejected(
            SimpleUploadedFile("cut.png", data[: len(data) // 2], content_type="image/png"), "not a valid image"
        )

    def test_corrupt_header_is_rejected(self):
        data = b"\x89PNG\r\n\x1a\n" + os.urandom(200)
        self.assertImageRejected(SimpleUploadedFile("bad.png", data, content_type="image/png"))

    def test_image_with_too_many_pixels_is_rejected(self):
        with override_settings(IMAGE_MAX_PIXELS=500):
            self.assertImageRejected(image_upload("huge.png", "PNG", size=(100, 100)), "dimensions are too large")

    def test_non_file_value_in_the_image_field_is_rejected(self):
        response = self.client.post(URL, {**REQUEST_PAYLOAD, "image": "not-a-file"}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data["errors"])
        self.assertEqual(ServiceRequest.objects.count(), 0)
