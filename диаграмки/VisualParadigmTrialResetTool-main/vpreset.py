import os
import shutil

def delete_folder_in_appdata(folder_name):
    # Lấy đường dẫn AppData\Local của người dùng
    appdata_roaming = os.getenv('APPDATA')

    if not appdata_roaming:
        print("Không tìm thấy thư mục AppData\\Roaming.")
        return

    folder_path = os.path.join(appdata_roaming, folder_name)

    if os.path.exists(folder_path):
        try:
            shutil.rmtree(folder_path)
            print(f"Đã xóa thư mục: {folder_path}")
        except Exception as e:
            print(f"Lỗi khi xóa thư mục: {e}")
    else:
        print(f"Thư mục không tồn tại: {folder_path}")
print("Visual Paradigm Trial Reset Tool")
print("Author: Matapv01")
print("Version: 1.0")
print("This tool will reset your Visual Paradigm trial license.")
print("-------------------------------")
print("Make sure you have backed up your projects in Visual Paradigm before reset trial.")
print("if you have not backed up your projects, please do it now.")
print("else, please close Visual Paradigm and press 1 to continue.")
print("Press 1 to continue...")
if (input() != "1"):
    print("Exiting...")
    exit()
print("Resetting Visual Paradigm trial license...")
delete_folder_in_appdata("VisualParadigm")
print("Visual Paradigm trial license has been reset.")
print("You can now use Visual Paradigm for another trial period.")
print("Enjoy!")

