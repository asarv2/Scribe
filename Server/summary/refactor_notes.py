# want to move all files out of LinearProgramming/Week */Lecture/ into Notes/

import os
import shutil

for week in range(1, 15):
    lecture_dir = f"/Users/ashoksaravanan/Coding/ScribeLec/Server/summary/LinearProgramming/Week {week}/Lecture/"
    notes_dir = f"/Users/ashoksaravanan/Coding/ScribeLec/Server/summary/Notes/"
    os.makedirs(notes_dir, exist_ok=True)
    for file in os.listdir(lecture_dir):
        shutil.move(os.path.join(lecture_dir, file), os.path.join(notes_dir, file))
