import type { CSSProperties } from 'react';
import type { DrawerProps, ModalProps } from 'antd';

export const FLOATING_LAYER_TOKENS = {
  headerHeight: 56,
  footerHeight: 56,
  contentPadding: 24,
  viewportGap: 48,
  mobileViewportGap: 32,
  modalBodyReservedHeight: 180,
  separator: '1px solid var(--color-border-secondary)',
} as const;

export const FLOATING_LAYER_WIDTHS = {
  confirmModal: 480,
  formModal: 640,
  complexModal: 800,
  detailModal: 960,
  detailDrawer: 560,
  complexDrawer: 900,
} as const;

export const FLOATING_LAYER_MAX_WIDTH = 'calc(100vw - var(--floating-layer-viewport-gap, 48px))';

type ModalStyleOverrides = {
  container?: CSSProperties;
  body?: CSSProperties;
};

export function getModalStyles(overrides: ModalStyleOverrides = {}): NonNullable<ModalProps['styles']> {
  const { headerHeight, footerHeight, contentPadding, modalBodyReservedHeight, separator } = FLOATING_LAYER_TOKENS;
  return {
    container: {
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 'calc(100dvh - var(--floating-layer-viewport-gap, 48px))',
      padding: 0,
      ...overrides.container,
    },
    header: {
      boxSizing: 'border-box',
      display: 'flex',
      flex: 'none',
      alignItems: 'center',
      height: headerHeight,
      margin: 0,
      padding: `0 ${contentPadding}px`,
      borderBottom: separator,
    },
    body: {
      boxSizing: 'border-box',
      maxHeight: `calc(100dvh - ${modalBodyReservedHeight}px)`,
      overflow: 'auto',
      padding: contentPadding,
      ...overrides.body,
    },
    footer: {
      boxSizing: 'border-box',
      display: 'flex',
      flex: 'none',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
      height: footerHeight,
      margin: 0,
      padding: `12px ${contentPadding}px`,
      borderTop: separator,
    },
  };
}

type DrawerStyleOverrides = {
  wrapper?: CSSProperties;
  body?: CSSProperties;
};

export function getDrawerStyles(overrides: DrawerStyleOverrides = {}): NonNullable<DrawerProps['styles']> {
  const { headerHeight, contentPadding, separator } = FLOATING_LAYER_TOKENS;
  return {
    wrapper: {
      maxWidth: FLOATING_LAYER_MAX_WIDTH,
      ...overrides.wrapper,
    },
    header: {
      boxSizing: 'border-box',
      display: 'flex',
      flex: 'none',
      alignItems: 'center',
      height: headerHeight,
      padding: `0 ${contentPadding}px`,
      borderBottom: separator,
    },
    body: {
      boxSizing: 'border-box',
      overflow: 'auto',
      padding: contentPadding,
      ...overrides.body,
    },
  };
}
