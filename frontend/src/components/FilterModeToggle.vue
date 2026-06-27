<script setup lang="ts">
defineProps<{
  // Whether the owning filter is currently in negation (exclude) mode.
  excluded: boolean
  mobile?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

// The pill lives inside an autocomplete/select prepend-inner slot. Suppress the
// mousedown so the surrounding field does not open its menu or steal focus, but
// do NOT toggle here — otherwise mousedown + click would fire the toggle twice
// and cancel out. The click handler alone owns the state change.
function onMousedown(event: Event) {
  event.stopPropagation()
  event.preventDefault()
}

function onClick(event: Event) {
  event.stopPropagation()
  event.preventDefault()
  emit('toggle')
}
</script>

<template>
  <button
    type="button"
    class="filter-mode-pill"
    :class="{
      'filter-mode-pill--excluded': excluded,
      'filter-mode-pill--mobile': mobile,
    }"
    :aria-pressed="excluded"
    :title="
      excluded
        ? 'Excluding the selected values — click to include instead'
        : 'Including the selected values — click to exclude instead'
    "
    @mousedown="onMousedown"
    @click="onClick"
  >
    {{ excluded ? 'IS NOT' : 'IS' }}
  </button>
</template>

<style scoped lang="scss">
.filter-mode-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  margin-right: 6px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.filter-mode-pill:hover {
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}

.filter-mode-pill--excluded,
.filter-mode-pill--excluded:hover {
  background: rgb(var(--v-theme-error));
  border-color: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
}

.filter-mode-pill--excluded:hover {
  opacity: 0.9;
}

.filter-mode-pill--mobile {
  height: 30px;
  padding: 0 12px;
  font-size: 0.7rem;
}

.filter-mode-pill:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}
</style>
