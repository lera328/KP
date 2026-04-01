from django.contrib import admin

from .models import Course, Group, GroupStudent, GroupTeacher


admin.site.register(Course)
admin.site.register(Group)
admin.site.register(GroupStudent)
admin.site.register(GroupTeacher)
