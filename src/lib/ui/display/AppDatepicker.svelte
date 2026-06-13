<script lang="ts">
  import { Datepicker } from 'flowbite-svelte';
  import type { DateOrRange } from 'flowbite-svelte';

  let {
    value = $bindable<Date | undefined>(undefined),
    placeholder = 'Select date',
    dateFormat = undefined as Intl.DateTimeFormatOptions | undefined,
    disabled = false,
    required = false,
    inline = false,
    range = false,
    rangeFrom = $bindable<Date | undefined>(undefined),
    rangeTo = $bindable<Date | undefined>(undefined),
    availableFrom = null as Date | null,
    availableTo = null as Date | null,
    onselect = undefined as ((x: DateOrRange) => void) | undefined,
    className = ''
  }: {
    value?: Date | undefined;
    placeholder?: string;
    dateFormat?: Intl.DateTimeFormatOptions;
    disabled?: boolean;
    required?: boolean;
    inline?: boolean;
    range?: boolean;
    rangeFrom?: Date | undefined;
    rangeTo?: Date | undefined;
    availableFrom?: Date | null;
    availableTo?: Date | null;
    onselect?: (x: DateOrRange) => void;
    className?: string;
  } = $props();
</script>

<div class="app-datepicker {className}">
  <Datepicker
    bind:value
    bind:rangeFrom
    bind:rangeTo
    {placeholder}
    {dateFormat}
    {disabled}
    {required}
    {inline}
    {range}
    {availableFrom}
    {availableTo}
    {onselect}
    color="primary"
    inputClass="app-datepicker__input"
  />
</div>

<style>
  .app-datepicker { width: 100%; }

  :global(.app-datepicker__input) {
    height: 38px !important;
    border: 1px solid var(--color-border) !important;
    border-radius: var(--radius) !important;
    background: var(--color-surface) !important;
    color: var(--color-text) !important;
    font-family: var(--font-body) !important;
    font-size: 0.875rem !important;
    padding: 8px 12px !important;
    width: 100% !important;
  }

  :global(.app-datepicker__input:focus) {
    outline: 2px solid var(--color-accent) !important;
    outline-offset: 2px !important;
    border-color: var(--color-accent) !important;
  }

  :global(.app-datepicker [data-popper-placement]) {
    border: 1px solid var(--color-border) !important;
    border-radius: var(--radius) !important;
    background: var(--color-surface) !important;
    box-shadow: var(--shadow-md) !important;
    font-family: var(--font-body) !important;
  }
</style>
