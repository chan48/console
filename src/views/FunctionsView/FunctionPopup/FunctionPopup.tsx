import * as React from 'react'
import mapProps from '../../../components/MapProps/MapProps'
import { createRefetchContainer, graphql } from 'react-relay'
import * as Modal from 'react-modal'
import modalStyle from '../../../utils/modalStyle'
import { withRouter } from 'found'
import ModalDocs from '../../../components/ModalDocs/ModalDocs'
import PopupHeader from '../../../components/PopupHeader'
import PopupFooter from '../../../components/PopupFooter'
import { Model, Project, ServerlessFunction } from '../../../types/types'
import {
  didChange,
  getDefaultSSSQuery,
  getEmptyFunction,
  getWebhookUrl,
  inlineCode,
  isValid,
  updateBinding,
  updateInlineCode,
  updateModel,
  updateName,
  updateOperation,
  updateQuery,
  updateType,
  updateWebhookHeaders,
  updateWebhookUrl,
} from './functionPopupState'
import Step0 from './Step0'
import * as cookiestore from 'cookiestore'
import Trigger from './Trigger'
import FunctionEditor from './FunctionEditor'
import { RelayProp } from 'react-relay'
import { showNotification } from '../../../actions/notification'
import { connect } from 'react-redux'
import AddRequestPipelineMutationFunction from '../../../mutations/Functions/AddRequestPipelineMutationFunction'
import { onFailureShowNotification } from '../../../utils/relay'
import { ShowNotificationCallback } from '../../../types/utils'
import Loading from '../../../components/Loading/Loading'
import UpdateRequestPipelineMutationFunction from '../../../mutations/Functions/UpdateRequestPipelineMutationFunction'
import DeleteFunction from '../../../mutations/Functions/DeleteFunction'
import AddServerSideSubscriptionFunction from '../../../mutations/Functions/AddServerSideSubscriptionFunction'
import UpdateServerSideSubscriptionFunction from '../../../mutations/Functions/UpdateServerSideSubscriptionFunction'
import { getEventTypeFromFunction } from '../../../utils/functions'
import TestButton from './TestButton'
import AddSchemaExtensionFunction from '../../../mutations/Functions/AddSchemaExtensionFunction'
import UpdateSchemaExtensionFunction from '../../../mutations/Functions/UpdateSchemaExtensionFunction'
import { dummy } from '../../../utils/dummy'

export type EventType = 'SSS' | 'RP' | 'SCHEMA_EXTENSION'
export const eventTypes: EventType[] = ['SSS', 'RP', 'SCHEMA_EXTENSION']

interface Props {
  params: any
  router: any
  models: Model[]
  relay: RelayProp
  schema: string
  showNotification: ShowNotificationCallback
  project: Project
  node: ServerlessFunction
  functions: ServerlessFunction[]
  location: any
  isBeta: boolean
}

export interface FunctionPopupState {
  activeTabIndex: number
  editing: boolean
  showErrors: boolean
  fn: ServerlessFunction
  loading: boolean
  eventType: EventType
  showTest: boolean
  sssModelName: string
  didChange: boolean
}

const customModalStyle = {
  overlay: modalStyle.overlay,
  content: {
    ...modalStyle.content,
    width: 820,
  },
}

let isSSS = false

class FunctionPopup extends React.Component<Props, FunctionPopupState> {
  private lastInlineCode: string

  constructor(props: Props) {
    super(props)

    // prepare node that comes from the server

    const eventType = getEventTypeFromFunction(props.node)

    let newNode = props.node
    if (props.node) {
      if (props.node.model) {
        newNode = {
          ...newNode,
          modelId: newNode.model.id,
        }
      }
      if (props.node.auth0Id && props.node.auth0Id.length > 0) {
        newNode = {
          ...newNode,
          _inlineWebhookUrl: newNode.webhookUrl,
        }
      } else if (props.node.type !== 'WEBHOOK') {
        // transition to the truth
        newNode = {
          ...newNode,
          type: 'WEBHOOK',
        }
      }
      if (props.node.type === 'WEBHOOK') {
        newNode = {
          ...newNode,
          _webhookUrl: newNode.webhookUrl,
        }
      }
      if (props.node.webhookHeaders && props.node.webhookHeaders.length > 0) {
        try {
          newNode = {
            ...newNode,
            _webhookHeaders: JSON.parse(newNode.webhookHeaders),
          }
        } catch (e) {
          //
        }
      }

      if (eventType === 'SCHEMA_EXTENSION') {
        newNode = {
          ...newNode,
          schemaExtension: newNode.schema,
          query: newNode.schema,
        }
      }
    }

    this.state = {
      activeTabIndex: 0,
      editing: Boolean(newNode),
      showErrors: false,
      fn: newNode || getEmptyFunction(props.models, props.functions, 'RP'),
      loading: false,
      eventType,
      showTest: false,
      sssModelName: props.models[0].name,
      didChange: false,
    }

    this.props.relay.refetch(fragmentVariables => ({
      ...fragmentVariables,
      modelSelected: true,
      operation: (newNode && newNode.operation) || 'CREATE',
      selectedModelName:
        (newNode && newNode.model && newNode.model.name) || 'User',
      binding: (newNode && newNode.binding) || 'PRE_WRITE',
    }))
    isSSS = this.state.eventType === 'SSS'
  }

  componentDidUpdate(prevProps: Props, prevState: FunctionPopupState) {
    if (
      prevState.fn.modelId !== this.state.fn.modelId ||
      prevState.fn.operation !== this.state.fn.operation ||
      prevState.fn.binding !== this.state.fn.binding
    ) {
      this.props.relay.refetch(fragmentVariables => ({
        ...fragmentVariables,
        modelSelected: true,
        operation: this.state.fn.operation,
        selectedModelName: this.props.models.find(
          model => model.id === this.state.fn.modelId,
        ).name,
        binding: this.state.fn.binding,
      }))
    }

    if (prevState.sssModelName !== this.state.sssModelName) {
      this.update(updateQuery.bind(this, this.state.eventType))(
        getDefaultSSSQuery(this.state.sssModelName),
      )
    }
  }

  componentDidMount() {
    window.addEventListener('resize', this.rerender)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.rerender)
  }

  rerender = () => {
    this.forceUpdate()
  }

  getFunctionQuery(): string {
    const { fn, eventType } = this.state

    if (eventType === 'SSS') {
      return fn.query
    }

    if (eventType === 'SCHEMA_EXTENSION') {
      return fn.schemaExtension
    }

    return ''
  }

  render() {
    const { models, schema, functions, isBeta } = this.props
    const {
      activeTabIndex,
      editing,
      showErrors,
      fn,
      eventType,
      loading,
      sssModelName,
    } = this.state

    const isInline = fn.type === 'AUTH0'
    const changed = didChange(this.state.fn, isInline, this.props.node)
    const valid = isValid(this.state)

    const tabs = this.getTabs()

    return (
      <Modal
        contentLabel="Function Popup"
        style={customModalStyle}
        isOpen
        onRequestClose={e => {
          if (
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLInputElement
          ) {
            return
          }
          this.close(true)
        }}
      >
        <ModalDocs
          title="How do functions work?"
          id="functions-popup"
          resources={[
            {
              title: 'Overview over Functions',
              type: 'guide',
              link:
                'https://www.graph.cool/docs/reference/functions/overview-boo6uteemo/',
            },
          ]}
          videoId="l-0jGOxXKGY"
        >
          <div className="function-popup">
            <style jsx>{`
              .function-popup {
                @p: .bgWhite, .relative;
              }
              .popup-body {
                @p: .overflowAuto;
                max-height: calc(100vh - 200px);
              }
              .loading {
                @p: .absolute, .bgWhite70, .flex, .itemsCenter, .justifyCenter,
                  .z999;
                top: -10px;
                left: -10px;
                right: -10px;
                bottom: -10px;
                box-shadow: 0 0 5px 5px rga(255, 255, 255, 0.7);
                content: "";
              }
            `}</style>
            <PopupHeader
              creatingTitle="New Function"
              editingTitle="Editing Function"
              errorInTab={this.errorInTab}
              onRequestClose={this.close}
              activeTabIndex={activeTabIndex}
              editing={editing}
              onSelectTab={this.setTabIndex}
              showErrors={showErrors}
              tabs={tabs}
            />
            <div className="popup-body">
              {activeTabIndex === 0 &&
                !editing &&
                <Step0
                  eventType={eventType}
                  onChangeEventType={this.handleEventTypeChange}
                  sssModelName={sssModelName}
                  onChangeSSSModel={this.handleChangeSSSModel}
                  models={models}
                  isBeta={isBeta}
                />}
              {activeTabIndex === 1 &&
                !editing &&
                eventType === 'RP' &&
                <Trigger
                  models={models}
                  selectedModelId={fn.modelId}
                  binding={fn.binding}
                  onModelChange={this.update(updateModel)}
                  onBindingChange={this.update(updateBinding)}
                  operation={fn.operation}
                  onChangeOperation={this.update(updateOperation)}
                  functions={functions}
                />}
              {((eventType === 'RP' &&
                (editing ? activeTabIndex === 0 : activeTabIndex === 2)) ||
                (['SSS', 'SCHEMA_EXTENSION'].includes(eventType) &&
                  (editing ? activeTabIndex === 0 : activeTabIndex === 1))) &&
                <FunctionEditor
                  name={fn.name}
                  inlineCode={fn.inlineCode}
                  onInlineCodeChange={this.update(updateInlineCode)}
                  onNameChange={this.update(updateName)}
                  binding={fn.binding}
                  isInline={isInline}
                  onTypeChange={this.update(updateType)}
                  onChangeUrl={this.update(updateWebhookUrl)}
                  webhookUrl={getWebhookUrl(this.state)}
                  schema={schema}
                  headers={fn._webhookHeaders}
                  onChangeHeaders={this.update(updateWebhookHeaders)}
                  editing={editing}
                  query={this.getFunctionQuery()}
                  onChangeQuery={this.update(updateQuery.bind(this, eventType))}
                  eventType={eventType}
                  projectId={this.props.project.id}
                  sssModelName={this.state.sssModelName}
                  modelName={
                    fn.model
                      ? fn.model.name
                      : fn.modelId
                        ? models.find(m => m.id === fn.modelId).name
                        : undefined
                  }
                  operation={fn.operation}
                  showErrors={this.state.showErrors}
                  updateFunction={this.updateExtendFunction}
                  location={this.props.location}
                  params={this.props.params}
                />}
            </div>
            <PopupFooter
              entityName="Function"
              tabs={tabs}
              activeTabIndex={activeTabIndex}
              changed={changed}
              create={!editing}
              valid={valid}
              onCancel={this.cancel}
              onDelete={this.delete}
              onSubmit={this.submit}
              onSelectIndex={this.setTabIndex}
              getButtonForTab={this.footerButtonForTab}
            />
            {loading &&
              <div className="loading">
                <Loading />
              </div>}
          </div>
        </ModalDocs>
      </Modal>
    )
  }

  private handleChangeSSSModel = e => {
    this.setState({ sssModelName: e.target.value } as FunctionPopupState)
  }

  private footerButtonForTab = (index: number) => {
    const { editing } = this.state
    if (
      editing ||
      (this.state.eventType === 'RP' && index === 2) ||
      (['SSS', 'SCHEMA_EXTENSION'].includes(this.state.eventType) &&
        index === 1)
    ) {
      return (
        <TestButton onClick={this.openFullscreen}>Fullscreen Mode</TestButton>
      )
    }

    return null
  }

  private openFullscreen = () => {
    const { pathname } = this.props.location
    const newUrl = pathname + '/fullscreen'
    this.props.router.push(newUrl)
  }

  private getTabs = () => {
    const { eventType } = this.state

    if (eventType === 'RP') {
      if (this.state.editing) {
        return ['Update Function']
      } else {
        return [
          'Choose Event Trigger',
          'Configure Event Trigger',
          'Define Function',
        ]
      }
    }

    if ('SSS' === eventType) {
      if (this.state.editing) {
        return ['Update Function']
      } else {
        return ['Choose Event Trigger', 'Define Function']
      }
    }

    if ('SCHEMA_EXTENSION' === eventType) {
      if (this.state.editing) {
        return ['Update Resolver']
      } else {
        return ['Choose Event Trigger', 'Define resolver']
      }
    }

    return ['Choose Event Trigger']
  }

  private handleEventTypeChange = (eventType: EventType) => {
    this.setState({ eventType } as FunctionPopupState)
    this.update(updateInlineCode, () => {
      // do not ask for unsaved changes when still in Step0
      this.setState({ didChange: false })
    })(inlineCode(eventType))
  }

  private update = (func: any, done?: (...args: any[]) => void) => {
    return (...params) => {
      this.setState(
        ({ fn, ...state }) => {
          return {
            ...state,
            didChange: true,
            fn: func(fn, ...params),
          }
        },
        () => {
          if (typeof done === 'function') {
            done()
          }
        },
      )
    }
  }

  private createExtendFunction = () => {
    const code = this.state.fn.inlineCode
    const authToken = cookiestore.get('graphcool_auth_token')

    this.lastInlineCode = code

    return fetch(
      'https://d0b5iw4041.execute-api.eu-west-1.amazonaws.com/prod/create/',
      {
        method: 'post',
        body: JSON.stringify({ code, authToken }),
      },
    ).then(res => res.json())
  }

  private updateExtendFunction = () => {
    // first create the new function, set the state, then resolve the promise
    return new Promise((resolve, reject) => {
      if (this.lastInlineCode === this.state.fn.inlineCode) {
        const { webhookUrl, auth0Id } = this.state.fn
        return resolve({ webhookUrl, auth0Id })
      }
      this.createExtendFunction()
        .then((res: any) => {
          const webhookUrl = res.url
          const auth0Id = res.fn

          this.setState(
            state => {
              return {
                ...state,
                fn: {
                  ...state.fn,
                  _inlineWebhookUrl: webhookUrl,
                  webhookUrl,
                  auth0Id,
                },
              }
            },
            () => {
              resolve({ webhookUrl, auth0Id })
            },
          )
        })
        .catch(reject)
    })
  }

  private cancel = () => {
    this.close(true)
  }

  private delete = () => {
    // smepty
    this.setLoading(true)
    DeleteFunction.commit({
      functionId: this.props.node.id,
      projectId: this.props.project.id,
    })
      .then(() => {
        this.close()
        this.setLoading(false)
      })
      .catch(transaction => {
        onFailureShowNotification(transaction, this.props.showNotification)
        this.setLoading(false)
      })
  }

  private submit = () => {
    if (!isValid(this.state)) {
      return this.setState({ showErrors: true } as FunctionPopupState)
    }
    this.setState({ loading: true } as FunctionPopupState)
    if (this.state.fn.type === 'AUTH0') {
      this.createExtendFunction().then((res: any) => {
        const { url, fn } = res
        if (this.state.editing) {
          this.updateFunction(url, fn)
        } else {
          this.createFunction(url, fn)
        }
      })
    } else {
      const webhookUrl = getWebhookUrl(this.state)
      if (this.state.editing) {
        this.updateFunction(webhookUrl)
      } else {
        this.createFunction(webhookUrl)
      }
    }
  }

  private updateFunction(webhookUrl?: string, auth0Id?: string) {
    const { fn } = this.state
    const isInline = fn.type === 'AUTH0'
    const input = {
      ...fn,
      projectId: this.props.project.id,
      webhookUrl: webhookUrl || getWebhookUrl(this.state),
      webhookHeaders: fn._webhookHeaders
        ? JSON.stringify(fn._webhookHeaders)
        : '',
      auth0Id: isInline ? auth0Id || fn.auth0Id : null,
      functionId: fn.id,
      inlineCode: isInline ? fn.inlineCode : null,
    }
    if (this.state.eventType === 'RP') {
      return this.updateRPFunction(input)
    } else if (this.state.eventType === 'SSS') {
      return this.updateSSSFunction(input)
    } else if (this.state.eventType === 'SCHEMA_EXTENSION') {
      return this.updateSchemaExtension(input)
    }
  }

  private createFunction(webhookUrl?: string, auth0Id?: string) {
    const { fn } = this.state
    const isInline = fn.type === 'AUTH0'
    const input = {
      ...fn,
      projectId: this.props.project.id,
      webhookUrl: webhookUrl || getWebhookUrl(this.state),
      auth0Id: auth0Id || fn.auth0Id,
      webhookHeaders: fn._webhookHeaders
        ? JSON.stringify(fn._webhookHeaders)
        : '',
      inlineCode: isInline ? fn.inlineCode : '',
    }
    if (this.state.eventType === 'RP') {
      return this.createRPFunction(input)
    } else if (this.state.eventType === 'SSS') {
      return this.createSSSFunction(input)
    } else if (this.state.eventType === 'SCHEMA_EXTENSION') {
      return this.createSchemaExtension(input)
    }
  }

  private createSSSFunction(input) {
    this.setLoading(true)
    AddServerSideSubscriptionFunction.commit(input)
      .then(() => {
        this.close()
        this.setLoading(false)
      })
      .catch(transaction => {
        onFailureShowNotification(transaction, this.props.showNotification)
        this.setLoading(false)
      })
  }

  private createRPFunction(input) {
    this.setLoading(true)
    AddRequestPipelineMutationFunction.commit(input)
      .then(() => {
        this.close()
        this.setLoading(false)
      })
      .catch(transaction => {
        onFailureShowNotification(transaction, this.props.showNotification)
        this.setLoading(false)
      })
  }

  private createSchemaExtension(input) {
    this.setLoading(true)
    AddSchemaExtensionFunction.commit({
      ...input,
      schema: input.schemaExtension,
    })
      .then(() => {
        this.close()
        this.setLoading(false)
      })
      .catch(transaction => {
        onFailureShowNotification(transaction, this.props.showNotification)
        this.setLoading(false)
      })
  }

  private updateSSSFunction(input) {
    this.setLoading(true)
    UpdateServerSideSubscriptionFunction.commit(input)
      .then(() => {
        this.close()
        this.setLoading(false)
      })
      .catch(transaction => {
        onFailureShowNotification(transaction, this.props.showNotification)
        this.setLoading(false)
      })
  }

  private updateRPFunction(input) {
    this.setLoading(true)
    UpdateRequestPipelineMutationFunction.commit(input)
      .then(() => {
        this.close()
        this.setLoading(false)
      })
      .catch(transaction => {
        onFailureShowNotification(transaction, this.props.showNotification)
        this.setLoading(false)
      })
  }

  private updateSchemaExtension(input) {
    this.setLoading(true)
    UpdateSchemaExtensionFunction.commit({
      ...input,
      schema: input.schemaExtension,
    })
      .then(() => {
        this.close()
        this.setLoading(false)
      })
      .catch(transaction => {
        onFailureShowNotification(transaction, this.props.showNotification)
        this.setLoading(false)
      })
  }

  private close = (checkClose: boolean = false) => {
    const { router, params } = this.props
    const { fn } = this.state
    const changed = this.state.didChange

    if (changed && checkClose) {
      graphcoolConfirm(
        `You have unsaved changes in your function "${fn.name}". Do you want to proceed?`,
      ).then(() => {
        router.push(`/${params.projectName}/functions`)
      })
    } else {
      router.push(`/${params.projectName}/functions`)
    }
  }

  private errorInTab = (index: number) => false

  private setTabIndex = (index: number) => {
    this.setState({ activeTabIndex: index } as FunctionPopupState)
  }

  private setLoading = (loading: boolean) => {
    this.setState({ loading } as FunctionPopupState)
  }
}
export function getIsInline(fn: ServerlessFunction | null): boolean {
  return !!fn.auth0Id
}

const ConnectedFunctionPopup = connect(null, { showNotification })(
  FunctionPopup,
)

const MappedFunctionPopup = mapProps({
  project: props => props.viewer.project,
  models: props => props.viewer.project.models.edges.map(edge => edge.node),
  schema: props =>
    props.viewer.model && props.viewer.model.requestPipelineFunctionSchema,
  node: props => props.node || null,
  functions: props =>
    props.viewer.project.functions
      ? props.viewer.project.functions.edges.map(edge => edge.node)
      : [],
  isBeta: props => props.viewer.user.crm.information.isBeta,
})(withRouter(ConnectedFunctionPopup))

export default createRefetchContainer(
  MappedFunctionPopup,
  {
    viewer: graphql.experimental`
      fragment FunctionPopup_viewer on Viewer
        @argumentDefinitions(
          selectedModelName: { type: "String!", defaultValue: "" }
          modelSelected: { type: "Boolean!", defaultValue: false }
          binding: {
            type: "FunctionBinding!"
            defaultValue: TRANSFORM_ARGUMENT
          }
          operation: {
            type: "RequestPipelineMutationOperation!"
            defaultValue: CREATE
          }
        ) {
        id
        user {
          crm {
            information {
              isBeta
            }
          }
        }
        project: projectByName(projectName: $projectName) {
          id
          name
          models(first: 1000) {
            edges {
              node {
                id
                name
              }
            }
          }
          functions(first: 1000) {
            edges {
              node {
                id
                __typename
              }
            }
          }
        }
        model: modelByName(
          modelName: $selectedModelName
          projectName: $projectName
        ) @include(if: $modelSelected) {
          id
          name
          requestPipelineFunctionSchema(
            binding: $binding
            operation: $operation
          )
        }
      }
    `,
    node: graphql`
      fragment FunctionPopup_node on Function {
        __typename
        id
        name
        inlineCode
        isActive
        type
        auth0Id
        webhookHeaders
        webhookUrl
        ... on SchemaExtensionFunction {
          schema
        }
        ... on ServerSideSubscriptionFunction {
          query
        }
        ... on RequestPipelineMutationFunction {
          binding
          model {
            id
            name
          }
          operation
        }
      }
    `,
  },
  graphql.experimental`
    query FunctionPopupRefetchQuery(
      $projectName: String!
      $selectedModelName: String!
      $binding: FunctionBinding!
      $operation: RequestPipelineMutationOperation!
      $modelSelected: Boolean!
    ) {
      viewer {
        ...FunctionPopup_viewer
          @arguments(
            selectedModelName: $selectedModelName
            binding: $binding
            operation: $operation
            modelSelected: $modelSelected
          )
      }
    }
  `,
)

const mutationFragments = graphql`
  fragment FunctionPopup_function on Function {
    __typename
    id
    name
    inlineCode
    isActive
    type
    auth0Id
    webhookHeaders
    webhookUrl
  }
`

dummy(mutationFragments)
