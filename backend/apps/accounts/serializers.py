from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import phone_validator

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Public representation of the signed-in user."""

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "phone_number", "role", "date_joined")
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    """Citizen self-registration.

    There is intentionally no ``role`` field: anything a client sends for it is
    ignored, so registration can never produce an administrator.
    """

    full_name = serializers.CharField(
        max_length=150,
        trim_whitespace=True,
        error_messages={
            "blank": "Please enter your full name.",
            "required": "Please enter your full name.",
        },
    )
    email = serializers.EmailField(
        max_length=254,
        error_messages={
            "invalid": "Enter a valid email address.",
            "blank": "Please enter your email address.",
            "required": "Please enter your email address.",
        },
    )
    phone_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True, validators=[phone_validator]
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
        error_messages={"blank": "Please choose a password.", "required": "Please choose a password."},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
        error_messages={"blank": "Please confirm your password.", "required": "Please confirm your password."},
    )

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Please enter your full name.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists. Try signing in.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "The two passwords do not match."})

        candidate = User(email=attrs.get("email", ""), full_name=attrs.get("full_name", ""))
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={
            "invalid": "Enter a valid email address.",
            "blank": "Please enter your email address.",
            "required": "Please enter your email address.",
        }
    )
    password = serializers.CharField(
        trim_whitespace=False,
        style={"input_type": "password"},
        error_messages={"blank": "Please enter your password.", "required": "Please enter your password."},
    )
