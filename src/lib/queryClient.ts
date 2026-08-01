import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      // Mantener los datos frescos por 5 minutos
      staleTime: 1000 * 60 * 5, 
      // La basura (GC) no borrará los datos de la memoria hasta que pasen 7 días
      gcTime: 1000 * 60 * 60 * 24 * 7, 
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
})