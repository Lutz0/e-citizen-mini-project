"""Populate a development database with demo accounts and realistic sample requests.

    python manage.py seed_demo --password "<a password you choose>"
    python manage.py seed_demo --reset          # wipe previous demo requests first

Safety: refuses to run unless DEBUG is on (or --force is given), so it can't
accidentally plant well-known accounts in a production database. No password is
stored in the repository: pass --password, set DEMO_PASSWORD, or let the command
generate a random one and print it once.
"""
import os
import secrets
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.test import override_settings
from django.utils import timezone
from PIL import Image, ImageDraw

from apps.accounts.models import Role, User
from apps.service_requests import services
from apps.service_requests.domain import Category, Severity, Status
from apps.service_requests.models import Comment, ServiceRequest, StatusChange
from apps.service_requests.validators import validate_and_sanitize_image

ADMIN = {"email": "admin@example.test", "full_name": "Grace Wanjiku"}
CITIZENS = {
    "amina": {"email": "amina@example.test", "full_name": "Amina Hassan", "phone_number": "0712 345 678"},
    "brian": {"email": "brian@example.test", "full_name": "Brian Otieno", "phone_number": "0722 111 222"},
    "cynthia": {"email": "cynthia@example.test", "full_name": "Cynthia Mutua", "phone_number": ""},
}

C, S, V = Category, Severity, Status

# (owner, category, location, description, severity, final status, age in days, with photo)
SAMPLE_REQUESTS = [
    ("amina", C.STREETLIGHTS, "Ngong Road, near Prestige Plaza",
     "Three consecutive streetlights have been out for over a week. The stretch is very dark and unsafe for pedestrians at night.",
     S.HIGH, V.RESOLVED, 26, False),
    ("brian", C.WATER, "Kibera, Laini Saba estate",
     "No running water for four days. Residents are queueing at a single kiosk and prices have doubled.",
     S.HIGH, V.IN_PROGRESS, 6, False),
    ("cynthia", C.WASTE, "Githurai 45 market",
     "Garbage bins have been overflowing since last week. The smell is attracting flies and stray dogs near the food stalls.",
     S.MEDIUM, V.PENDING, 3, True),
    ("amina", C.ROADS, "Thika Road, Roysambu flyover exit",
     "A deep pothole in the left lane is damaging vehicles and causing drivers to brake suddenly.",
     S.HIGH, V.IN_PROGRESS, 9, True),
    ("brian", C.DRAINAGE, "Mombasa Road, opposite Capital Centre",
     "Blocked drain floods the footpath whenever it rains and the water pools for hours.",
     S.MEDIUM, V.RESOLVED, 20, False),
    ("cynthia", C.OTHER, "Uhuru Park, main walkway",
     "A broken park bench with exposed nails is a danger to children playing nearby.",
     S.LOW, V.PENDING, 2, False),
    ("cynthia", C.STREETLIGHTS, "Moi Avenue, Nairobi CBD",
     "Lamp post number 14 outside the pharmacy flickers on and off all evening.",
     S.LOW, V.RESOLVED, 15, False),
    ("amina", C.WATER, "South B, Mugoya estate",
     "A leaking water main has been running into the street since Monday, wasting water and eroding the road edge.",
     S.HIGH, V.PENDING, 1, True),
    ("brian", C.WASTE, "Eastleigh, 1st Avenue",
     "Garbage has not been collected for two weeks and is piling up at the junction.",
     S.MEDIUM, V.IN_PROGRESS, 11, False),
    ("cynthia", C.ROADS, "Ngara Road, near the footbridge",
     "The zebra crossing markings have faded completely and motorists no longer stop for schoolchildren.",
     S.MEDIUM, V.PENDING, 5, False),
    ("amina", C.DRAINAGE, "Kasarani, Mwiki Road",
     "An open manhole with no cover sits right next to the primary school gate.",
     S.HIGH, V.RESOLVED, 12, False),
    ("brian", C.STREETLIGHTS, "Lang'ata Road, Carnivore junction",
     "Streetlights around the junction are not switching on at night.",
     S.MEDIUM, V.PENDING, 0, False),
    ("amina", C.OTHER, "Kilimani, Argwings Kodhek Road",
     "Illegally dumped construction rubble is blocking half of the service lane.",
     S.MEDIUM, V.IN_PROGRESS, 8, False),
    ("brian", C.WASTE, "Kawangware, Gatina market",
     "The skip bin by the market entrance was removed and traders are dumping rubbish on the roadside.",
     S.LOW, V.RESOLVED, 28, False),
    ("cynthia", C.WATER, "Embakasi, Pipeline estate",
     "Tap water has turned brown and smells strongly of chemicals. Several families report stomach upsets.",
     S.HIGH, V.IN_PROGRESS, 4, False),
    ("amina", C.ROADS, "Waiyaki Way, Westlands",
     "Large cracks and a sunken section of tarmac near the bus stop make the road hazardous for cyclists.",
     S.MEDIUM, V.PENDING, 7, False),
    ("brian", C.DRAINAGE, "Kileleshwa, Othaya Road",
     "The roadside drain is clogged with plastic bags and has started to overflow onto the pavement.",
     S.LOW, V.RESOLVED, 22, False),
    ("cynthia", C.STREETLIGHTS, "Kenyatta Avenue, near the Hilton",
     "Two lamp posts were knocked over by a vehicle and the live wires are exposed.",
     S.HIGH, V.PENDING, 1, False),
]

# More volume, with several requests landing on the same day, so charts have a realistic shape.
SAMPLE_REQUESTS += [
    ("brian", C.ROADS, "Mombasa Road, Syokimau flyover", "Deep potholes at the flyover exit are forcing trucks to swerve into the next lane.", S.HIGH, V.RESOLVED, 24, False),
    ("cynthia", C.WASTE, "Kayole, Spine Road", "Uncollected rubbish has blocked the footpath outside the nursery school.", S.MEDIUM, V.RESOLVED, 24, False),
    ("amina", C.STREETLIGHTS, "Juja Road, Mathare North", "The whole street has been without lights for ten days and muggings have been reported.", S.HIGH, V.RESOLVED, 23, False),
    ("brian", C.DRAINAGE, "Ruaraka, Thika Road service lane", "A collapsed culvert is sending storm water across the service lane.", S.HIGH, V.RESOLVED, 21, False),
    ("cynthia", C.WATER, "Dagoretti Corner", "Low water pressure all week; the estate tank never fills.", S.MEDIUM, V.RESOLVED, 21, False),
    ("amina", C.OTHER, "Gikomba market, Row C", "Broken stall roofing is dropping sheets of iron onto the walkway.", S.HIGH, V.RESOLVED, 19, False),
    ("brian", C.WASTE, "Umoja 1, near the shopping centre", "Dumped garbage is blocking the stormwater drain beside the road.", S.MEDIUM, V.RESOLVED, 18, False),
    ("cynthia", C.STREETLIGHTS, "Outer Ring Road, Donholm", "Two lamp posts are leaning dangerously after a lorry hit them.", S.HIGH, V.RESOLVED, 18, False),
    ("amina", C.ROADS, "Lunga Lunga Road, Industrial Area", "Missing manhole covers on the roadside present a serious hazard.", S.HIGH, V.RESOLVED, 16, False),
    ("brian", C.DRAINAGE, "Pangani, Muratina Street", "Sewage is overflowing from a blocked manhole into the street.", S.HIGH, V.RESOLVED, 14, False),
    ("cynthia", C.OTHER, "Karura Forest Road gate", "Fallen tree branches have blocked half of the access road.", S.LOW, V.RESOLVED, 13, False),
    ("amina", C.WATER, "Ruai, Kamulu Road", "A burst pipe has left sections of the village without water for a week.", S.HIGH, V.IN_PROGRESS, 10, False),
    ("brian", C.ROADS, "Jogoo Road, Makadara", "The road edge has crumbled away near the bus stop and a matatu nearly tipped over.", S.HIGH, V.IN_PROGRESS, 10, False),
    ("cynthia", C.WASTE, "Kangemi, Ndumbo Road", "The collection truck hasn't visited in three weeks.", S.MEDIUM, V.IN_PROGRESS, 9, False),
    ("amina", C.STREETLIGHTS, "Naivasha Road, Riruta", "Streetlights stay on all day and waste power while others are dark.", S.LOW, V.IN_PROGRESS, 7, False),
    ("brian", C.DRAINAGE, "Gitanga Road, Lavington", "Roadside drain is silted up and floods the junction when it rains.", S.MEDIUM, V.IN_PROGRESS, 6, False),
    ("cynthia", C.OTHER, "Jeevanjee Gardens", "Vandalised public toilets are unusable and have a foul smell.", S.MEDIUM, V.IN_PROGRESS, 5, False),
    ("amina", C.WATER, "Mathare, Area 4", "Illegal connections are causing frequent pipe bursts on the main line.", S.MEDIUM, V.PENDING, 6, False),
    ("brian", C.STREETLIGHTS, "Eastern Bypass, Kamulu", "No lighting at the pedestrian crossing near the school.", S.HIGH, V.PENDING, 4, False),
    ("cynthia", C.ROADS, "Kiambu Road, Ridgeways", "Speed bumps have worn away and cars now race past the school gate.", S.MEDIUM, V.PENDING, 4, False),
    ("amina", C.WASTE, "Kibra, Kianda", "A public bin was burned down; waste is now piling up in the open.", S.MEDIUM, V.PENDING, 3, False),
    ("brian", C.DRAINAGE, "Kitengela, Namanga Road", "Open drainage channel beside the footpath has no cover, and children use the path.", S.HIGH, V.PENDING, 3, False),
    ("cynthia", C.WATER, "Zimmerman, Thika Road", "Brown water from taps for the second day running.", S.MEDIUM, V.PENDING, 2, False),
    ("amina", C.OTHER, "Nairobi River bridge, Ngara", "The bridge handrail is broken and people could fall into the river.", S.HIGH, V.PENDING, 1, False),
    ("brian", C.ROADS, "Limuru Road, Gigiri", "Flooded section after rain; the road is impassable for small cars.", S.MEDIUM, V.PENDING, 0, False),
]

START_NOTES = {
    C.STREETLIGHTS: "Electrical crew assigned. Parts have been ordered.",
    C.WATER: "Water utility notified and a repair team is on its way.",
    C.WASTE: "Added to the next collection route; a clean-up truck is scheduled.",
    C.ROADS: "Roads department has inspected the site and scheduled repairs.",
    C.DRAINAGE: "Drainage crew assigned to clear the blockage.",
    C.OTHER: "Inspection completed. Work is being arranged.",
}
RESOLVE_NOTES = {
    C.STREETLIGHTS: "Faulty fittings replaced and tested after dark.",
    C.WATER: "Pipe repaired and supply restored.",
    C.WASTE: "Waste cleared and a replacement bin installed.",
    C.ROADS: "Surface repaired and road reopened.",
    C.DRAINAGE: "Drain cleared and covers replaced.",
    C.OTHER: "Issue resolved and site left clean.",
}


def placeholder_photo(label, seed):
    """A simple generated 'photo' so the image workflow is visible in demos."""
    width, height = 640, 400
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    base = (70 + seed * 13 % 80, 90 + seed * 29 % 70, 110 + seed * 17 % 60)
    for y in range(height):  # vertical gradient sky -> ground
        shade = y / height
        draw.line([(0, y), (width, y)], fill=tuple(int(c * (1.15 - 0.6 * shade)) for c in base))
    draw.rectangle([0, 260, width, height], fill=(78, 78, 82))  # road
    draw.ellipse([220, 290, 420, 360], fill=(34, 34, 38))  # hazard
    draw.text((20, 20), f"DEMO PHOTO - {label}", fill=(255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=80)
    return SimpleUploadedFile(f"demo-{seed}.jpg", buffer.getvalue(), content_type="image/jpeg")


class Command(BaseCommand):
    help = "Create demo accounts and sample service requests (development only)."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=os.getenv("DEMO_PASSWORD"), help="Password for all demo accounts.")
        parser.add_argument("--reset", action="store_true", help="Delete existing demo requests first.")
        parser.add_argument("--force", action="store_true", help="Allow running with DEBUG=false.")

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError("seed_demo creates well-known accounts and only runs with DEBUG=true (use --force to override).")

        password = options["password"]
        generated = not password
        if generated:
            password = secrets.token_urlsafe(12)

        demo_emails = [ADMIN["email"]] + [c["email"] for c in CITIZENS.values()]
        existing = ServiceRequest.objects.filter(citizen__email__in=demo_emails)
        if existing.exists() and not options["reset"]:
            raise CommandError(f"{existing.count()} demo requests already exist. Re-run with --reset to replace them.")

        # Do not email the demo citizens (or spam the console) while seeding.
        with override_settings(EMAIL_BACKEND="django.core.mail.backends.dummy.EmailBackend"), transaction.atomic():
            if options["reset"]:
                existing.delete()
            admin = self._upsert_user(ADMIN, password, Role.ADMIN)
            citizens = {key: self._upsert_user(data, password, Role.CITIZEN) for key, data in CITIZENS.items()}
            for index, row in enumerate(SAMPLE_REQUESTS):
                self._create_request(index, row, citizens, admin)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(SAMPLE_REQUESTS)} requests."))
        self.stdout.write("Demo accounts (all share one password):")
        self.stdout.write(f"  administrator: {ADMIN['email']}")
        for data in CITIZENS.values():
            self.stdout.write(f"  citizen:       {data['email']}")
        if generated:
            self.stdout.write(f"Generated password (shown once): {password}")

    def _upsert_user(self, data, password, role):
        user = User.objects.filter(email=data["email"]).first()
        if user is None:
            user = User.objects.create_user(password=password, role=role, **data)
        else:
            user.full_name, user.role, user.is_active = data["full_name"], role, True
            user.set_password(password)
            user.save()
        return user

    def _create_request(self, index, row, citizens, admin):
        owner_key, category, location, description, severity, final_status, age_days, with_photo = row
        owner = citizens[owner_key]
        now = timezone.now()

        image = None
        if with_photo:
            image = validate_and_sanitize_image(placeholder_photo(category.label, index))

        request = services.create_request(
            citizen=owner, category=category, location=location, description=description,
            severity=severity, image=image,
        )

        if final_status in (V.IN_PROGRESS, V.RESOLVED):
            services.change_status(service_request=request, new_status=V.IN_PROGRESS, actor=admin, note=START_NOTES[category])
        if final_status == V.RESOLVED:
            services.change_status(service_request=request, new_status=V.RESOLVED, actor=admin, note=RESOLVE_NOTES[category])

        # Back-date so dashboards and trend charts have a believable history.
        created = now - timedelta(days=age_days, hours=1 + index % 7)
        started = created + timedelta(hours=5 + index % 9)
        resolved = started + timedelta(hours=18 + (index * 11) % 70)
        if final_status != V.PENDING and started > now:
            started = now - timedelta(minutes=30)
        if final_status == V.RESOLVED and resolved > now:
            resolved = now - timedelta(minutes=5)

        ServiceRequest.objects.filter(pk=request.pk).update(
            created_at=created,
            in_progress_at=started if final_status != V.PENDING else None,
            resolved_at=resolved if final_status == V.RESOLVED else None,
            updated_at={V.PENDING: created, V.IN_PROGRESS: started, V.RESOLVED: resolved}[final_status],
        )
        for change in StatusChange.objects.filter(service_request=request):
            when = {V.PENDING: created, V.IN_PROGRESS: started, V.RESOLVED: resolved}[change.to_status]
            StatusChange.objects.filter(pk=change.pk).update(created_at=when)

        if final_status == V.IN_PROGRESS and index % 2 == 1:
            comment = Comment.objects.create(
                service_request=request, author=admin,
                body="Our team visited the site today. We will update you again once the work is complete.",
            )
            Comment.objects.filter(pk=comment.pk).update(created_at=started + timedelta(hours=3))
            reply = Comment.objects.create(
                service_request=request, author=owner, body="Thank you for the update, I'll keep an eye on it.",
            )
            Comment.objects.filter(pk=reply.pk).update(created_at=started + timedelta(hours=7))
