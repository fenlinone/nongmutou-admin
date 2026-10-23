import type { DefaultOptionType } from 'antd/es/select';

/** 大棚筛选统一使用名称包含匹配，允许输入任意片段快速定位选项。 */
export function filterGreenhouseOption(input: string, option?: DefaultOptionType) {
  const keyword = input.trim().toLocaleLowerCase();
  const label = String(option?.label ?? option?.value ?? '').toLocaleLowerCase();
  return label.includes(keyword);
}

/** 对齐采摘称重的大棚选择器搜索和下拉列表规格。 */
export const greenhouseSelectSearchProps = {
  showSearch: true,
  optionFilterProp: 'label' as const,
  popupMatchSelectWidth: 260,
  listHeight: 320,
  filterOption: filterGreenhouseOption,
};
