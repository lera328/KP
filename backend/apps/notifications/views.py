from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdminRole

from .services import send_low_balance_payment_reminders


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def send_payment_reminders_view(request):
    threshold = request.data.get("threshold")
    if threshold is not None:
        try:
            threshold = int(threshold)
        except ValueError:
            return Response({"error": "threshold must be integer"}, status=status.HTTP_400_BAD_REQUEST)

    result = send_low_balance_payment_reminders(threshold=threshold)
    return Response(result, status=status.HTTP_200_OK)
