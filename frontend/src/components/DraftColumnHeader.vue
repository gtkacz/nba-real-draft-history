<script setup lang="ts">
defineProps<{
  title?: string
  sortable: boolean
  isSorted: boolean
  sortIcon?: string | null
}>()

// Sorting is handled by the data table's own header-cell click; this component only
// renders the label + sort indicator and exposes the resize grip.
const emit = defineEmits<{
  resizeStart: [event: PointerEvent]
}>()
</script>

<template>
  <div class="draft-col-header">
    <span
      class="draft-col-header__label"
      :class="{ 'draft-col-header__label--sortable': sortable }"
    >
      {{ title }}
      <v-icon
        v-if="isSorted && sortIcon"
        :icon="sortIcon"
        size="14"
        class="draft-col-header__sort"
      />
    </span>
    <span
      class="draft-col-header__grip"
      title="Drag to resize column"
      @pointerdown.stop.prevent="emit('resizeStart', $event)"
      @click.stop
    />
  </div>
</template>

<style scoped lang="scss">
.draft-col-header {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 4px;

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--sortable {
      cursor: pointer;
    }
  }

  &__sort {
    flex-shrink: 0;
    color: rgb(var(--v-theme-primary));
  }

  // Persistent, visible resize handle pinned to the cell's right edge. The header
  // cell is position:sticky (a positioned ancestor), so right:0 lands on the column
  // boundary regardless of the cell's padding. A faint divider is always shown so the
  // handle is discoverable; it brightens and thickens on hover.
  &__grip {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    height: 100%;
    width: 16px;
    cursor: col-resize;
    touch-action: none;

    &::after {
      content: '';
      position: absolute;
      top: 22%;
      bottom: 22%;
      right: 0;
      width: 2px;
      border-radius: 1px;
      background: rgba(var(--v-theme-on-surface), 0.25);
      transition: background-color 120ms ease, top 120ms ease, bottom 120ms ease, width 120ms ease;
    }

    &:hover::after {
      // top: 0;
      // bottom: 0;
      // width: 3px;
      background: rgb(var(--v-theme-primary));
    }
  }
}
</style>
