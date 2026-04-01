from django.contrib import admin

from .models import AttendanceRecord, Lesson, LessonTopic, MakeUpRequest


admin.site.register(LessonTopic)
admin.site.register(Lesson)
admin.site.register(AttendanceRecord)
admin.site.register(MakeUpRequest)
