import whisper

model = whisper.load_model('base.en', in_memory=True)

result = model.transcribe("Practice.mp4", fp16=False, word_timestamps=True)

with open("transcript.txt", "w") as f:
    last_timestamp = None
    group_size = 3  # Number of sentences per group
    group_text = []
    group_start_time = None
    
    for i, segment in enumerate(result['segments']):
        segment_text = segment['text']
        segment_start = segment['start']
        segment_end = segment['end']

        # If it's the first sentence in the group, set the group's start time
        if len(group_text) == 0:
            group_start_time = segment_start

        # Add the current segment to the group
        group_text.append(segment_text)

        # If the group has reached the desired size (e.g., 3 sentences) or it's the last segment
        if len(group_text) == group_size or i == len(result['segments']) - 1:
            # Write the timestamp for the start of the group
            f.write(f"\n[{group_start_time:.2f}s]: ")

            # Write the combined text for this group of sentences
            f.write(" ".join(group_text) + "\n")

            # Reset the group for the next set of sentences
            group_text = []

print(result.keys())
