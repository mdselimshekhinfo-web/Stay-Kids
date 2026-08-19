import os, time, shutil, datetime

desktop = os.path.join(os.environ['USERPROFILE'], 'Desktop')
parent_apk = r'android\app\build\outputs\apk\parent\release\app-parent-release.apk'
child_apk = r'android\app\build\outputs\apk\child\release\app-child-release.apk'

print('Waiting for APKs...')
while not os.path.exists(parent_apk) or not os.path.exists(child_apk):
    time.sleep(10)

print('Copying APKs...')
try:
    shutil.copy(parent_apk, os.path.join(desktop, 'StayKids_Parent_Production.apk'))
    shutil.copy(child_apk, os.path.join(desktop, 'StayKids_Child_Production.apk'))
except Exception as e:
    print('Failed to copy', e)

print('Zipping source...')
timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M')
zip_path = os.path.join(desktop, f'StayKids_Source_{timestamp}')
try:
    shutil.make_archive(zip_path, 'zip', '.')
except Exception as e:
    print('Failed to zip', e)
print('Done!')
