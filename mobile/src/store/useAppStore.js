import { create } from 'zustand';
import { fetchHeatmap, fetchTags } from '../services/api';

export const useAppStore = create((set, get) => ({
  userLocation: null,
  heatmapCells: [],
  timeFilter: 'all',
  isLoading: false,
  isRatingActive: false,
  tags: { predefined: [], popular_custom: [] },

  setUserLocation: (loc) => set({ userLocation: loc }),
  
  setTimeFilter: (timeFilter) => {
    set({ timeFilter });
    // Refetch with new filter
    get().fetchHeatmapData();
  },

  setRatingActive: (active) => set({ isRatingActive: active }),

  fetchHeatmapData: async (bounds = null) => {
    set({ isLoading: true });
    try {
      const cells = await fetchHeatmap(bounds, get().timeFilter);
      set({ heatmapCells: cells });
    } finally {
      set({ isLoading: false });
    }
  },

  loadTags: async () => {
    const list = await fetchTags();
    set({ tags: list });
  }
}));
