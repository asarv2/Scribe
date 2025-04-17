def get_video_prompt():
    base_prompt = (
        "You are an expert at identifying the title of a video."
        "Given the transcription of a video, "
        "you will identify a descriptive title. "
        "The title should be a single sentence that captures the essence of the video content. "
        "It should be in Title Case and capture the main topic of the video."
        "You should only return the title, no other text."
        "Here is an example of a good title: Help With Precalculus"
    )

    return base_prompt