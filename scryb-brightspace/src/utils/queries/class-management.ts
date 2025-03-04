import { getSupabaseClient } from '../supabase-client';

// Add a new class to Supabase
export async function addClass(classData: {
  name: string;
  course_id: string;
  description: string;
}) {
  const client = getSupabaseClient();
  
  try {
    const { data, error } = await client
      .from('classes')
      .insert([{
        ...classData,
        active: true,
        deleted: false
      }]);
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error adding class:', error);
    return { success: false, error };
  }
}

// Update an existing class
export async function updateClass(id: string, updates: {
  name?: string;
  description?: string;
  active?: boolean;
}) {
  const client = getSupabaseClient();
  
  try {
    const { data, error } = await client
      .from('classes')
      .update(updates)
      .eq('id', id);
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating class:', error);
    return { success: false, error };
  }
}

// Mark a class as deleted (soft delete)
export async function deleteClass(id: string) {
  const client = getSupabaseClient();
  
  try {
    const { data, error } = await client
      .from('classes')
      .update({ deleted: true })
      .eq('id', id);
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting class:', error);
    return { success: false, error };
  }
}

// Get a class by course ID
export async function getClassByCourseId(courseId: string) {
  const client = getSupabaseClient();
  
  try {
    const { data, error } = await client
      .from('classes')
      .select('*')
      .eq('course_id', courseId)
      .eq('deleted', false)
      .single();
      
    if (error) {
      // If not found, return null without throwing
      if (error.code === 'PGRST116') {
        return { success: true, data: null };
      }
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching class:', error);
    return { success: false, error };
  }
} 