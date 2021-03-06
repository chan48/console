import * as React from 'react'
import { Icon } from 'graphcool-styles'
import * as cn from 'classnames'

interface Props {
  onSelectIndex: (index: number) => void
  activeTabIndex: number
  tabs: string[]
  valid: boolean
  create: boolean
  changed: boolean
  onDelete: () => void
  onCancel: (e: any) => void
  onSubmit: any
  entityName: string
  getButtonForTab?: (tab: number) => React.ReactChild
}

export default class PopupFooter extends React.Component<Props, null> {
  render() {
    const {
      activeTabIndex,
      tabs,
      onSelectIndex,
      create,
      onSubmit,
      changed,
      onDelete,
      onCancel,
      entityName,
      getButtonForTab,
    } = this.props

    return (
      <div className="popup-footer">
        <style jsx>{`
          .popup-footer {
            @p: .bbox, .bgBlack02, .bt, .bBlack10, .pr16, .flex, .justifyBetween,
              .itemsCenter, .relative;
            height: 80px;
            padding-left: 30px;
          }
          .cancel,
          .delete {
            @p: .f16, .black50, .pointer;
          }
          .cancel {
            @p: .black50;
          }
          .delete {
            @p: .red;
          }
          .next-name,
          .prev-name {
            @p: .ttu, .fw6, .f14, .blue, .blue;
            letter-spacing: 0.53px;
          }
          .prev-name {
            @p: .ml10;
          }
          .next-name {
            @p: .mr10;
          }
          .prev {
            @p: .o60;
          }
          .divider {
            @p: .mh16;
            border: 1px solid rgba(42, 126, 211, 0.3);
            height: 30px;
          }
          .prev,
          .next,
          .buttons {
            @p: .flex, .itemsCenter;
          }
          .next,
          .prev {
            @p: .pointer;
          }
          .next {
            @p: .ml25;
          }
          .button {
            @p: .bgBlack07, .black30, .f16, .ph16, .br2, .ml25;
            cursor: no-drop;
            padding-top: 9px;
            padding-bottom: 10px;
          }
          .button.active {
            @p: .bgGreen, .white, .pointer;
          }
          .next-name.needs-migration,
          .prev-name.needs-migration {
            @p: .lightOrange;
          }
        `}</style>
        {create
          ? <div className="cancel" onClick={onCancel}>
              Cancel
            </div>
          : <div>
              <div className="delete" onClick={onDelete}>
                Delete
              </div>
            </div>}
        <div className="buttons">
          <div
            className="prev"
            onClick={() => onSelectIndex(activeTabIndex - 1)}
          >
            {activeTabIndex > 0 &&
              <Icon
                src={require('../assets/icons/blue_arrow_left.svg')}
                stroke
                strokeWidth={2}
                width={13}
                height={13}
              />}
            {activeTabIndex > 0 &&
              <div className="prev-name">
                {tabs[activeTabIndex - 1]}
              </div>}
          </div>
          <div
            className="next"
            onClick={() => onSelectIndex(activeTabIndex + 1)}
          >
            {activeTabIndex < tabs.length - 1 &&
              <div className="next-name">
                {tabs[activeTabIndex + 1]}
              </div>}
            {activeTabIndex < tabs.length - 1 &&
              <Icon
                src={require('../assets/icons/blue_arrow_left.svg')}
                stroke
                strokeWidth={2}
                width={13}
                height={13}
                rotate={180}
              />}
          </div>
          {typeof getButtonForTab === 'function' &&
            getButtonForTab(activeTabIndex)}
          {(!create ||
            (create &&
              activeTabIndex === tabs.length - 1 &&
              tabs.length > 1)) &&
            <div
              className={cn('button', { active: create ? true : changed })}
              onClick={onSubmit}
            >
              {create ? 'Create' : 'Update'} {entityName}
            </div>}
        </div>
      </div>
    )
  }
}
