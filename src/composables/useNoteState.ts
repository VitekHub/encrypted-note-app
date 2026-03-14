import { ref } from 'vue'

const noteText = ref('')

export function useNoteState() {
  return { noteText }
}
