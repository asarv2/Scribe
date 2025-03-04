import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

const checkHealth = async () => {
  if (!process.env.PLASMO_PUBLIC_API_URL) {
    throw new Error('API URL is not configured');
  }

  try {
    const response = await fetch(`${process.env.PLASMO_PUBLIC_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
    });

    // Log the raw response for debugging
    const text = await response.text();

    try {
      const data = JSON.parse(text);
      if (data.status !== 'healthy') {
        throw new Error('Server is unhealthy');
      } else {
        console.log('Server is healthy');
      }
      return data;
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('Health check error:', error);
    throw error;
  }
};

export function HealthCheck() {
  const { isError, error } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30000,
    retry: 2,
  });

  useEffect(() => {
    if (isError) {
      console.error(error);
    }
  }, [isError, error]);

  return null;
}
