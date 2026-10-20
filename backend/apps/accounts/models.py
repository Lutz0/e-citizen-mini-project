from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    CITIZEN = "citizen", "Citizen"
    ADMIN = "admin", "Administrator"


phone_validator = RegexValidator(
    regex=r"^\+?[0-9][0-9\s\-]{6,19}$",
    message="Enter a valid phone number, for example 0712 345 678 or +254 712 345 678.",
)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def get_by_natural_key(self, email):
        # Emails are stored lower-cased; matching is case-insensitive regardless.
        return self.get(email__iexact=email)

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.CITIZEN)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        # Superusers are always administrators: the role is what the API checks.
        extra_fields["role"] = Role.ADMIN
        extra_fields["is_staff"] = True
        extra_fields["is_superuser"] = True
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Account used for both citizens and administrators.

    ``role`` is the single source of truth for application-level authorisation.
    It can only be set by an operator (``createsuperuser``, the Django admin or
    a management command) - public registration always creates citizens.
    """

    email = models.EmailField("email address", max_length=254, unique=True)
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True, validators=[phone_validator])
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CITIZEN, db_index=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(
        default=False, help_text="Allows access to the Django admin site (operators only)."
    )
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["full_name", "email"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        return self.full_name.split(" ")[0] if self.full_name else self.email

    @property
    def is_administrator(self):
        return self.role == Role.ADMIN

    @property
    def is_citizen(self):
        return self.role == Role.CITIZEN
