from piazza_api import Piazza
import os
from dotenv import load_dotenv

load_dotenv()

PIAZZA_USERNAME = os.getenv("PIAZZA_USERNAME")
PIAZZA_PASSWORD = os.getenv("PIAZZA_PASSWORD")

def get_class_posts(username: str, password: str, class_id: str):
    p = Piazza()
    p.user_login(username, password)
    
    # Get the specific class network
    course = p.network(class_id)
    
    # Get all posts
    posts = []
    try:
        # Get feed of all posts (limit=999999 to get all posts)
        feed = course.get_feed(limit=999999)
        
        # For each post in the feed, get the full post content
        for post in feed["feed"]:
            post_id = post["id"]
            full_post = course.get_post(post_id)
            posts.append(full_post)
            
        return posts
    except Exception as e:
        print(f"Error getting posts: {str(e)}")
        return None

def extract_question_content(post):
    """Extract the complete thread content from a post."""
    if not post.get('history'):
        return None
    
    # Get the original question
    original_post = post['history'][0]
    
    # Get instructor answer if it exists
    instructor_answer = None
    if 'instructor_answer' in post and post['instructor_answer']:
        instructor_answer = {
            'content': post['instructor_answer'].get('content', ''),
            'created': post['instructor_answer'].get('created', ''),
        }
    
    # Get student answer if it exists
    student_answer = None
    if 'student_answer' in post and post['student_answer']:
        student_answer = {
            'content': post['student_answer'].get('content', ''),
            'created': post['student_answer'].get('created', ''),
        }
    
    # Get followup discussions
    followups = []
    if 'children' in post:
        for followup in post['children']:
            followup_data = {
                'content': followup.get('subject', ''),  # Followups store content in 'subject'
                'created': followup.get('created', ''),
                'type': 'followup',
                'is_instructor': followup.get('config', {}).get('is_instructor', False),
            }
            
            # Get responses to this followup
            responses = []
            for response in followup.get('children', []):
                responses.append({
                    'content': response.get('subject', ''),  # Responses also store content in 'subject'
                    'created': response.get('created', ''),
                    'type': 'response',
                    'is_instructor': response.get('config', {}).get('is_instructor', False),
                })
            followup_data['responses'] = responses
            followups.append(followup_data)
    
    return {
        'post_number': post['nr'],
        'title': original_post.get('subject', 'No title'),
        'content': original_post.get('content', 'No content'),
        'type': post.get('type', 'Unknown type'),
        'created': post.get('created', 'Unknown date'),
        'is_private': post.get('status') == 'private',
        'instructor_answer': instructor_answer,
        'student_answer': student_answer,
        'followups': followups
    }

if __name__ == "__main__":
    # MA 428 class ID
    CLASS_ID = "m5r98ht2jbk420"
    
    posts = get_class_posts(PIAZZA_USERNAME, PIAZZA_PASSWORD, CLASS_ID)
    if posts:
        print(f"Found {len(posts)} posts:")
        for post in posts:
            thread = extract_question_content(post)
            if thread and thread['type'] == 'question':  # Only show questions
                print(f"\nQuestion #{thread['post_number']}:")
                print(f"Title: {thread['title']}")
                print(f"Created: {thread['created']}")
                print(f"Private: {thread['is_private']}")
                print("\nQuestion Content:")
                print(thread['content'])
                
                if thread['instructor_answer']:
                    print("\nInstructor Answer:")
                    print(f"Created: {thread['instructor_answer']['created']}")
                    print(thread['instructor_answer']['content'])
                
                if thread['student_answer']:
                    print("\nStudent Answer:")
                    print(f"Created: {thread['student_answer']['created']}")
                    print(thread['student_answer']['content'])
                
                if thread['followups']:
                    print("\nFollowup Discussions:")
                    for followup in thread['followups']:
                        print("\n- Followup:")
                        print(f"Created: {followup['created']}")
                        print(f"By instructor: {followup['is_instructor']}")
                        print(followup['content'])
                        
                        for response in followup['responses']:
                            print("\n  - Response:")
                            print(f"  Created: {response['created']}")
                            print(f"  By instructor: {response['is_instructor']}")
                            print(f"  {response['content']}")
                
                print("-" * 50)