import * as React from 'react'
import { buildClientSchema } from 'graphql'
import { createRefetchContainer, graphql, RelayProp } from 'react-relay'
import {
  Project,
  Operation,
  UserType,
  Model,
  ModelPermission,
  PermissionRuleType,
} from '../../../types/types'
import mapProps from '../../../components/MapProps/MapProps'
import { withRouter } from 'found'
import PermissionPopupHeader from './PermissionPopupHeader'
import PermissionPopupFooter from './PermissionPopupFooter'
import OperationChooser from './OperationChooser'
import PermissionConditions from './PermissionConditions'
import AffectedFields from './AffectedFields'
import AddModelPermissionMutation from '../../../mutations/ModelPermission/AddModelPermissionMutation'
import UpdateModelPermissionMutation from '../../../mutations/ModelPermission/UpdateModelPermissionMutation'
import tracker from '../../../utils/metrics'
import { ConsoleEvents, MutationType } from 'graphcool-metrics'
import DeleteModelPermissionMutation from '../../../mutations/ModelPermission/DeleteModelPermissionMutation'
import { isValid, didChange } from './PermissionPopupState'
import { connect } from 'react-redux'
import * as Modal from 'react-modal'
import { fieldModalStyle } from '../../../utils/modalStyle'
import Loading from '../../../components/Loading/Loading'
import { extractSelection, addVarsAndName } from './ast'
import { showNotification } from '../../../actions/notification'
import { onFailureShowNotification } from '../../../utils/relay'
import { ShowNotificationCallback } from '../../../types/utils'
import ModalDocs from '../../../components/ModalDocs/ModalDocs'
import { getEmptyPermissionQuery } from './data'

interface Props {
  params: any
  project: Project
  children: JSX.Element
  router: InjectedFoundRouter
  model?: Model
  permission?: ModelPermission
  showNotification: ShowNotificationCallback
  relay: RelayProp
}

export interface PermissionPopupState {
  selectedOperation: Operation
  fieldIds: string[]
  userType: UserType
  applyToWholeModel: boolean
  rule: PermissionRuleType
  ruleGraphQuery: string
  ruleName: string
  queryValid: boolean
  tabs: string[]
  showErrors: boolean
  selectedTabIndex: number
  editing: boolean
  loading: boolean
  queryChanged: boolean
}

const modalStyling = {
  ...fieldModalStyle,
  content: {
    ...fieldModalStyle.content,
    width: 750,
  },
}

class PermissionPopup extends React.Component<Props, PermissionPopupState> {
  private mutationType: MutationType

  constructor(props) {
    super(props)

    this.mutationType = props.permission ? 'Update' : 'Create'

    const schema = buildClientSchema(
      JSON.parse(this.props.model.permissionSchema),
    )
    if (props.permission) {
      const {
        operation,
        fieldIds,
        userType,
        applyToWholeModel,
        rule,
        ruleGraphQuery,
        ruleName,
      } = props.permission
      this.state = {
        selectedOperation: operation,
        fieldIds,
        userType,
        applyToWholeModel,
        ruleName,
        rule,
        ruleGraphQuery:
          !ruleGraphQuery || ruleGraphQuery === ''
            ? getEmptyPermissionQuery(props.model.name, operation, userType)
            : addVarsAndName(
                props.model.namePlural,
                ruleGraphQuery,
                props.model.permissionQueryArguments,
                schema,
              ),
        queryValid: true,
        tabs: ['Select affected Fields', 'Define Rules'],
        selectedTabIndex: 0,
        showErrors: false,
        editing: true,
        loading: false,
        queryChanged: false,
      }
      this.updateRelayVariables()
      return
    }

    this.state = {
      selectedOperation: null,
      fieldIds: [],
      userType: 'EVERYONE' as UserType,
      applyToWholeModel: false,
      rule: 'NONE' as PermissionRuleType,
      ruleGraphQuery: getEmptyPermissionQuery(
        props.model.name,
        'CREATE',
        'EVERYONE',
      ),
      queryValid: true,
      tabs: ['Select Operation', 'Select affected Fields', 'Define Rules'],
      selectedTabIndex: 0,
      showErrors: false,
      editing: false,
      loading: false,
      queryChanged: false,
      ruleName: '',
    }
  }

  updateRelayVariables() {
    if (this.state.selectedOperation) {
      this.props.relay.refetch(fragmentVariables => {
        return {
          ...fragmentVariables,
          operation: this.state.selectedOperation,
        }
      })
    }
  }

  componentDidMount() {
    tracker.track(
      ConsoleEvents.Permissions.Popup.opened({ type: this.mutationType }),
    )
  }

  componentWillReceiveProps(nextProps: Props) {
    if (
      this.props.model.permissionQueryArguments !==
        nextProps.model.permissionQueryArguments ||
      this.props.model.permissionQueryArguments.length !==
        nextProps.model.permissionQueryArguments.length
    ) {
      const { ruleGraphQuery } = nextProps.permission
      if (this.state.ruleGraphQuery) {
        const schema = buildClientSchema(
          JSON.parse(this.props.model.permissionSchema),
        )
        this.setState(state => ({
          ...state,
          ruleGraphQuery: addVarsAndName(
            nextProps.model.namePlural,
            ruleGraphQuery,
            nextProps.model.permissionQueryArguments,
            schema,
          ),
        }))
      }
    }
  }

  render() {
    const { params, model } = this.props
    const {
      selectedOperation,
      fieldIds,
      userType,
      applyToWholeModel,
      rule,
      ruleGraphQuery,
      ruleName,
      selectedTabIndex,
      showErrors,
      tabs,
      editing,
    } = this.state

    if (!model) {
      return null
    }

    const errors = isValid(this.state)
    const valid = !Object.keys(errors).reduce(
      (acc, curr) => acc || errors[curr],
      false,
    )
    const changed = didChange(this.state, this.props.permission)

    return (
      <Modal
        onRequestClose={e => {
          if (
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLInputElement
          ) {
            return
          }
          this.closePopup()
          tracker.track(
            ConsoleEvents.Permissions.Popup.canceled({
              type: this.mutationType,
            }),
          )
        }}
        isOpen={true}
        style={modalStyling}
        contentLabel="Permission Popup"
      >
        <style jsx>{`
          .permission-popup {
            @p: .flexColumn, .overflowVisible, .bgWhite, .relative;
          }
          .popup-body {
            max-height: calc(100vh - 200px);
          }
          .no-delete {
            @p: .pa38, .brown;
          }
          .loading {
            @p: .absolute, .top0, .bottom0, .flex, .itemsCenter, .justifyCenter,
              .bgWhite80, .z999;
            left: -20px;
            right: -20px;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
          }
        `}</style>
        <ModalDocs
          title="How do permissions work?"
          id="type-type-permission-popup"
          resources={[
            {
              title: 'Overview over Permissions',
              type: 'guide',
              link:
                'https://www.graph.cool/docs/reference/platform/authorization/overview-iegoo0heez/',
            },
            {
              title: 'How to define Permission Queries',
              type: 'guide',
              link:
                'https://www.graph.cool/docs/reference/platform/authorization/permission-queries-iox3aqu0ee/',
            },
            {
              title: 'Design Patterns',
              type: 'article',
              link:
                'https://www.graph.cool/docs/tutorials/authorization-content-management-system-miesho4goo/',
            },
          ]}
          videoId="l1KEssmlhPA"
        >
          <div className="permission-popup">
            <PermissionPopupHeader
              operation={this.state.selectedOperation}
              errors={errors}
              tabs={tabs}
              modelName={params.modelName}
              activeTabIndex={selectedTabIndex}
              onRequestClose={this.closePopup}
              onSelectTab={this.handleSelectTab}
              showErrors={showErrors}
              editing={editing}
            />
            <div className="popup-body">
              {(editing ? false : selectedTabIndex === 0) &&
                <OperationChooser
                  selectedOperation={selectedOperation}
                  setOperation={this.setOperation}
                  errors={errors}
                  showErrors={showErrors}
                />}
              {(editing ? selectedTabIndex === 0 : selectedTabIndex === 1) &&
                (selectedOperation !== null &&
                ['CREATE', 'READ', 'UPDATE'].includes(selectedOperation)
                  ? <AffectedFields
                      selectedOperation={selectedOperation}
                      model={model}
                      fieldIds={fieldIds}
                      toggleField={this.toggleField}
                      toggleApplyToWholeModel={this.toggleApplyToWholeModel}
                      applyToWholeModel={applyToWholeModel}
                      onSelectAll={this.handleSelectAll}
                      onReset={this.handleReset}
                      errors={errors}
                      showErrors={showErrors}
                    />
                  : <div className="no-delete">
                      A delete Mutation doesn't affect any particular fields as
                      the whole node gets deleted at once.
                    </div>)}
              {(editing ? selectedTabIndex === 1 : selectedTabIndex === 2) &&
                <PermissionConditions
                  userType={userType}
                  rule={rule}
                  permissionSchema={model.permissionSchema}
                  permissionQueryArguments={model.permissionQueryArguments}
                  ruleGraphQuery={ruleGraphQuery}
                  setUserType={this.setUserType}
                  setRuleGraphQuery={this.setRuleGraphQuery}
                  operation={selectedOperation}
                  queryValid={!errors.invalidQuery}
                  showErrors={showErrors}
                  onQueryValidityChange={this.handleQueryValidityChange}
                  ruleName={ruleName}
                  onRuleNameChange={this.handleRuleNameChange}
                  toggleUserType={this.handleToggleUserType}
                  toggleRuleType={this.handleToggleRuleType}
                />}
            </div>
            <PermissionPopupFooter
              valid={valid}
              onCancel={this.closePopup}
              onDelete={this.deletePermission}
              onSubmit={this.handleSubmit}
              create={!editing}
              onSelectIndex={this.handleSelectTab}
              activeTabIndex={this.state.selectedTabIndex}
              changed={changed}
              tabs={tabs}
            />
            {this.state.loading &&
              <div className="loading">
                <Loading />
              </div>}
          </div>
        </ModalDocs>
      </Modal>
    )
  }

  private handleToggleUserType = () => {
    this.setState(state => {
      const oldUserType = state.userType
      const userType = oldUserType === 'EVERYONE' ? 'AUTHENTICATED' : 'EVERYONE'
      let { ruleGraphQuery } = state
      const emptyDefault = getEmptyPermissionQuery(
        this.props.model.name,
        state.selectedOperation,
        state.userType,
      )
      if (
        !ruleGraphQuery ||
        ruleGraphQuery === '' ||
        ruleGraphQuery === emptyDefault
      ) {
        ruleGraphQuery = getEmptyPermissionQuery(
          this.props.model.name,
          state.selectedOperation,
          userType,
        )
      }
      return {
        ...state,
        ruleGraphQuery,
        userType,
      }
    })
  }

  private handleToggleRuleType = () => {
    this.setState(state => {
      const oldRule = state.rule
      return {
        ...state,
        rule: oldRule === 'GRAPH' ? 'NONE' : 'GRAPH',
      }
    })
  }

  private handleRuleNameChange = e => {
    this.setState(
      {
        ruleName: e.target.value,
      } as PermissionPopupState,
    )
  }

  private handleQueryValidityChange = (valid: boolean) => {
    this.setState({ queryValid: valid } as PermissionPopupState)
  }

  private handleSubmit = () => {
    const errors = isValid(this.state)
    const valid = !Object.keys(errors).reduce(
      (acc, curr) => acc || errors[curr],
      false,
    )

    if (!valid) {
      return this.setState(
        {
          showErrors: true,
        } as PermissionPopupState,
      )
    }

    if (this.state.editing) {
      this.updatePermission()
    } else {
      this.createPermission()
    }
  }

  private handleSelectAll = () => {
    const fieldIds = this.props.model.fields.edges.map(edge => edge.node.id)
    this.setState(
      {
        applyToWholeModel: false,
        fieldIds,
      } as PermissionPopupState,
    )
  }

  private handleReset = () => {
    this.setState(
      {
        applyToWholeModel: false,
        fieldIds: [],
      } as PermissionPopupState,
    )
  }

  private handleSelectTab = (index: number) => {
    this.setState({ selectedTabIndex: index } as PermissionPopupState)
  }

  private setOperation = (operation: Operation) => {
    this.setState(
      state => {
        let { ruleGraphQuery } = state
        if (!ruleGraphQuery || ruleGraphQuery === '') {
          ruleGraphQuery = getEmptyPermissionQuery(
            this.props.model.name,
            operation,
            state.userType,
          )
        }
        return {
          ...state,
          selectedOperation: operation,
          ruleGraphQuery,
        }
      },
      () => {
        this.updateRelayVariables()
      },
    )
  }

  private setRuleGraphQuery = (ruleGraphQuery: string) => {
    this.setState(
      {
        ruleGraphQuery,
        queryChanged: true,
      } as PermissionPopupState,
    )
  }

  private toggleField = (id: string) => {
    const applyToWholeModel = false
    if (!this.state.fieldIds.includes(id)) {
      const fieldIds = this.state.fieldIds.concat(id)
      this.setState({ fieldIds, applyToWholeModel } as PermissionPopupState)
    } else {
      const i = this.state.fieldIds.indexOf(id)

      const fieldIds = this.state.fieldIds.slice()
      fieldIds.splice(i, 1)

      this.setState({ fieldIds, applyToWholeModel } as PermissionPopupState)
    }
  }

  private setUserType = (userType: UserType) => {
    this.setState({ userType } as PermissionPopupState)
  }

  private toggleApplyToWholeModel = () => {
    const { applyToWholeModel } = this.state
    this.setState(
      {
        applyToWholeModel: !applyToWholeModel,
      } as PermissionPopupState,
    )
  }

  private updatePermission = () => {
    const { permission: { isActive, id } } = this.props
    const {
      selectedOperation,
      fieldIds,
      userType,
      applyToWholeModel,
      rule,
      ruleGraphQuery,
    } = this.state

    const updatedNode = {
      id,
      operation: selectedOperation,
      fieldIds,
      userType,
      applyToWholeModel,
      rule,
      ruleGraphQuery: extractSelection(ruleGraphQuery),
      isActive,
    }
    // console.log(`Before`)
    // console.log(ruleGraphQuery)
    // console.log(`After Extraction`)
    // console.log(updatedNode.ruleGraphQuery)
    tracker.track(
      ConsoleEvents.Permissions.Popup.submitted({ type: this.mutationType }),
    )

    this.setState({ loading: true } as PermissionPopupState, () => {
      UpdateModelPermissionMutation.commit(updatedNode)
        .then(() => this.closePopup())
        .catch(transaction => {
          onFailureShowNotification(transaction, this.props.showNotification)
          this.setState({ loading: false } as PermissionPopupState)
        })
    })
  }

  private createPermission = () => {
    const { model } = this.props
    const {
      selectedOperation,
      fieldIds,
      userType,
      applyToWholeModel,
      rule,
      ruleName,
      ruleGraphQuery,
    } = this.state

    tracker.track(
      ConsoleEvents.Permissions.Popup.submitted({ type: this.mutationType }),
    )
    this.setState({ loading: true } as PermissionPopupState, () => {
      const input = {
        modelId: model.id,
        operation: selectedOperation,
        fieldIds,
        userType,
        applyToWholeModel,
        rule,
        ruleName,
        ruleGraphQuery: extractSelection(ruleGraphQuery),
      }
      AddModelPermissionMutation.commit(input)
        .then(() => this.closePopup())
        .catch(transaction => {
          onFailureShowNotification(transaction, this.props.showNotification)
          this.setState({ loading: false } as PermissionPopupState)
        })
    })
  }

  private deletePermission = () => {
    const { permission: { id }, model } = this.props

    tracker.track(
      ConsoleEvents.Permissions.Popup.submitted({ type: this.mutationType }),
    )
    this.setState({ loading: true } as PermissionPopupState, () => {
      DeleteModelPermissionMutation.commit({
        modelPermissionId: id,
        modelId: model.id,
      })
        .then(() => this.closePopup())
        .catch(transaction => {
          onFailureShowNotification(transaction, this.props.showNotification)
          this.setState({ loading: false } as PermissionPopupState)
        })
    })
  }

  private closePopup = () => {
    const { router, params } = this.props
    router.push(`/${params.projectName}/permissions`)
  }
}

const ReduxContainer = connect(null, { showNotification })(PermissionPopup)

const MappedPermissionPopup = mapProps({
  permission: props => props.node || null,
  model: props => props.viewer && props.viewer.model,
})(ReduxContainer)

export default createRefetchContainer(
  withRouter(MappedPermissionPopup),
  {
    node: graphql`
      fragment PermissionPopup_node on Node {
        id
        ... on ModelPermission {
          applyToWholeModel
          fieldIds
          operation
          isActive
          rule
          ruleGraphQuery
          ruleName
          userType
        }
      }
    `,
    viewer: graphql.experimental`
      fragment PermissionPopup_viewer on Viewer
        @argumentDefinitions(
          operation: { type: "Operation!", defaultValue: READ }
        ) {
        model: modelByName(projectName: $projectName, modelName: $modelName) {
          id
          name
          namePlural
          permissionSchema(operation: $operation)
          permissionQueryArguments(operation: $operation) {
            group
            name
            typeName
          }
          fields(first: 1000) {
            edges {
              node {
                id
                name
                isList
                typeIdentifier
              }
            }
          }
          ...AffectedFields_model
        }
      }
    `,
  },
  graphql.experimental`
    query PermissionPopupRefetchQuery(
      $operation: Operation!
      $projectName: String!
      $modelName: String!
    ) {
      viewer {
        ...PermissionPopup_viewer @arguments(operation: $operation)
      }
    }
  `,
)
