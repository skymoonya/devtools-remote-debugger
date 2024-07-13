import nodes from '../common/nodes';
import BaseDomain from './domain';
import { DEVTOOL_OVERLAY } from '../common/constant';
import { Event } from './protocol';

export default class Overlay extends BaseDomain {
  namespace = 'Overlay';

  highlightConfig = {};

  highlightBox = {};

  /**
   * @static
   */
  static formatNumber(num) {
    if (num % 1 === 0) return num;

    const fixed = num.toFixed(2);
    const numArr = fixed.split('.');
    if (numArr[1] === '00') return numArr[0];
    return fixed;
  }

  /**
   * Extract attribute value from style
   * @static
   */
  static getStylePropertyValue(properties, styles) {
    if (Array.isArray(properties)) {
      return properties.map((key) => Number(styles[key].replace('px', '')));
    }

    return Number(styles[properties].replace('px', ''));
  }

  /**
   * rgba color
   * @static
   */
  static rgba({ r, g, b, a } = {}) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * @public
   */
  enable() {
    this.createHighlightBox();
    this.nodeHighlightRequested();
  }

  /**
   * @public
   * @param {Object} param
   * @param {String} param.nodeId node unique id
   * @param {String} param.nodeElement
   * @param {Object} param.highlightConfig
   */
  highlightNode({ nodeId, nodeElement, highlightConfig }) {
    const node = nodeElement || nodes.getNodeById(nodeId);
    if (
      !node ||
      [Node.TEXT_NODE, Node.COMMENT_NODE, Node.DOCUMENT_TYPE_NODE].includes(node.nodeType) ||
      ['LINK', 'SCRIPT', 'HEAD'].includes(node.nodeName) ||
      !(node instanceof HTMLElement) ||
      window.getComputedStyle(node).display === 'none'
    ) {
      return;
    }

    this.updateHighlightBox(highlightConfig, node);
  }

  /**
   * @public
   */
  hideHighlight() {
    if (this.highlightBox.containerBox) {
      this.highlightBox.containerBox.style.display = 'none';
    }
  }

  /**
   * Set dom inspection mode
   * @public
   * @param {Object} param
   * @param {String} param.mode inspect mode
   * @param {Object} param.highlightConfig
   */
  setInspectMode({ mode, highlightConfig }) {
    window.$$inspectMode = mode;
    this.highlightConfig = highlightConfig;
  }

  /**
 * @private
 */
  expandNode(node) {
    const nodeIds = [];
    while (!nodes.hasNode(node)) {
      const nodeId = nodes.getIdByNode(node);
      nodeIds.unshift(nodeId);
      node = node.parentNode;
    }

    nodeIds.unshift(nodes.getIdByNode(node));

    nodeIds.forEach((nodeId) => {
      this.requestChildNodes({ nodeId });
    });
  }

  /**
   * @private
   */
  requestChildNodes({ nodeId }) {
    if (nodes.hasRequestedChildNode.has(nodeId)) {
      return;
    }
    nodes.hasRequestedChildNode.add(nodeId);
    this.send({
      method: Event.setChildNodes,
      params: {
        parentId: nodeId,
        nodes: nodes.getChildNodes(nodes.getNodeById(nodeId), 2)
      }
    });
  }

  /**
   * @private
   */
  nodeHighlightRequested() {
    const highlight = (e) => {
      if (window.$$inspectMode !== 'searchForNode') return;
      e.stopPropagation();
      e.preventDefault();

      let { target } = e;

      if (e.touches) {
        const touch = e.touches[0];
        target = document.elementFromPoint(touch.clientX, touch.clientY);
      }

      this.highlightNode({
        nodeElement: target,
        highlightConfig: this.highlightConfig,
      });

      this.expandNode(target.parentNode);

      this.send({
        method: Event.nodeHighlightRequested,
        params: {
          nodeId: nodes.getIdByNode(target),
        },
      });
    };

    document.addEventListener('mousemove', highlight, true);
    document.addEventListener('touchmove', highlight, { passive: false });
  }

  /**
   * @private
   */
  createHighlightBox() {
    const containerBox = document.createElement('div');
    const contentBox = document.createElement('div');
    const marginBox = document.createElement('div');
    const tooltipsBox = document.createElement('div');

    [marginBox, contentBox, tooltipsBox].forEach((item) => {
      Object.assign(item.style, {
        padding: 0,
        margin: 0,
        position: 'fixed',
        borderSizing: 'border-box',
      });
      item.className = DEVTOOL_OVERLAY;
      containerBox.appendChild(item);
    });

    Object.assign(containerBox.style, {
      display: 'none',
      position: 'fixed',
      zIndex: 99999,
      pointerEvents: 'none',
      textShadow: 'none',
    });

    containerBox.className = DEVTOOL_OVERLAY;
    containerBox.id = DEVTOOL_OVERLAY;
    document.body.appendChild(containerBox);

    this.highlightBox = { containerBox, contentBox, marginBox, tooltipsBox };
  }

  /**
   * @private
   */
  updateHighlightBox(highlightConfig, node) {
    const styles = window.getComputedStyle(node);
    const margin = Overlay.getStylePropertyValue([
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left'
    ], styles);
    const padding = Overlay.getStylePropertyValue([
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left'
    ], styles);
    const border = Overlay.getStylePropertyValue([
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width'
    ], styles);
    const width = Overlay.getStylePropertyValue('width', styles);
    const height = Overlay.getStylePropertyValue('height', styles);
    const isBorderBox = window.getComputedStyle(node)['box-sizing'] === 'border-box';
    const { left, top } = node.getBoundingClientRect();

    // Need to determine if the value is a percentage
    const contentWidth = isNaN(width) ? (isBorderBox ? `calc(${styles.width} - ${padding[1]}px - ${padding[3]}px)` : `calc(${styles.width} + ${border[1]}px + ${border[3]}px)`) : (isBorderBox ? width - padding[1] - padding[3] : width + border[1] + border[3]);
    const contentHeight = isNaN(height) ? (isBorderBox ? `calc(${styles.height} - ${padding[0]}px - ${padding[2]}px)` : `calc(${styles.height} + ${border[0]}px + ${border[2]}px)`) : (isBorderBox ? height - padding[0] - padding[2] : height + border[0] + border[2]);
    const marginWidth = isNaN(width) ? (isBorderBox ? styles.width : `calc(${styles.width} + ${padding[1]}px + ${padding[3]}px + ${border[1]}px + ${border[3]}px)`) : (isBorderBox ? width : width + padding[1] + padding[3] + border[1] + border[3]);
    const marginHeight = isNaN(height) ? (isBorderBox ? styles.height : `calc(${styles.height} + ${padding[0]}px + ${padding[2]}px + ${border[0]}px + ${border[2]}px)`) : (isBorderBox ? height : height + padding[0] + padding[2] + border[0] + border[2]);

    const { contentColor, paddingColor, marginColor } = highlightConfig;
    const { containerBox, contentBox, marginBox, tooltipsBox } = this.highlightBox;

    const zoom = this.getDocumentZoom();

    containerBox.style.display = 'block';

    Object.assign(contentBox.style, {
      left: `${left / zoom.x}px`,
      top: `${top / zoom.y}px`,
      width: isNaN(contentWidth) ? contentWidth : `${contentWidth}px`,
      height: isNaN(contentHeight) ? contentHeight : `${contentHeight}px`,
      background: Overlay.rgba(contentColor),
      borderColor: Overlay.rgba(paddingColor),
      borderStyle: 'solid',
      borderWidth: `${padding[0]}px ${padding[1]}px ${padding[2]}px ${padding[3]}px`
    });

    Object.assign(marginBox.style, {
      left: `${(left / zoom.x) - margin[3]}px`,
      top: `${(top / zoom.y) - margin[0]}px`,
      width: isNaN(marginWidth) ? marginWidth : `${marginWidth}px`,
      height: isNaN(marginHeight) ? marginHeight : `${marginHeight}px`,
      borderColor: Overlay.rgba(marginColor),
      borderStyle: 'solid',
      borderWidth: `${margin[0]}px ${margin[1]}px ${margin[2]}px ${margin[3]}px`
    });

    const isTopPosition = (top / zoom.y) - margin[0] > 25;
    const cls = DEVTOOL_OVERLAY;
    const currentClassName = node.getAttribute('class');
    let showContentWidth;
    if (isNaN(contentWidth)) {
      const { width: contentBoxWidth } = contentBox.getBoundingClientRect();
      showContentWidth = Overlay.formatNumber(contentBoxWidth / zoom.x);
    } else {
      showContentWidth = Overlay.formatNumber(contentWidth);
    }
    let showContentHeight;
    if (isNaN(contentHeight)) {
      const { height: contentBoxHeight } = contentBox.getBoundingClientRect();
      showContentHeight = Overlay.formatNumber(contentBoxHeight / zoom.y);
    } else {
      showContentHeight = Overlay.formatNumber(contentHeight);
    }
    tooltipsBox.innerHTML = `
      <span class="${cls}" style="color:#973090;font-weight:bold">${node.nodeName.toLowerCase()}</span>
      <span class="${cls}" style="color:#3434B0;font-weight:bold">${currentClassName ? `.${currentClassName}` : ''}</span>
      <span class="${cls}" style="position:absolute;top:${isTopPosition ? 'auto' : '-4px'};bottom:${isTopPosition ? '-4px' : 'auto'};left:10px;width:8px;height:8px;background:#fff;transform:rotate(45deg);"></span>
      ${showContentWidth} x ${showContentHeight}
    `;

    Object.assign(tooltipsBox.style, {
      background: '#fff',
      left: `${(left / zoom.x) - margin[3]}px`,
      top: isTopPosition ? `${(top / zoom.y) - margin[0] - 30}px` : `${(top / zoom.y) + marginHeight + 10}px`,
      filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.3))',
      'border-radius': '2px',
      'font-size': '12px',
      padding: '2px 4px',
      color: '#8d8d8d',
    });
  }

  /**
   * @private
   */
  getDocumentZoom() {
    const transform = getComputedStyle(document.body).transform;
    if (transform === 'none') {
      return {
        x: 1,
        y: 1
      };
    }
    const transformArray = transform.slice(7, -1).split(',');
    return {
      x: +transformArray[0],
      y: +transformArray[3]
    };
  }
};
