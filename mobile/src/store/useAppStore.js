import { create } from 'zustand';
import { fetchHeatmap/*, fetchTags*/ } from '../services/api';

export const useAppStore = create((set, get) => ({
  userLocation: null,
  heatmapCells: [],
  selectedHour: 'live', // 'live' or integer (0-23)
  isLoading: false,
  isRatingActive: false,
  // tags: { predefined: [], popular_custom: [] },
  lastBounds: null,

  setUserLocation: (loc) => set({ userLocation: loc }),
  
  setSelectedHour: (selectedHour) => {
    set({ selectedHour });
    // Refetch the active bounding box with the new hour filter
    get().fetchHeatmapData(get().lastBounds);
  },

  setRatingActive: (active) => set({ isRatingActive: active }),

  fetchHeatmapData: async (bounds = null) => {
    if (bounds) {
      set({ lastBounds: bounds });
    }
    set({ isLoading: true });
    try {
      const cells = await fetchHeatmap(bounds || get().lastBounds, get().selectedHour);
      set({ heatmapCells: cells });
    } finally {
      set({ isLoading: false });
    }
  }

  // loadTags: async () => {
  //   const list = await fetchTags();
  //   set({ tags: list });
  // }
}));
