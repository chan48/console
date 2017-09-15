import * as React from 'react'
import { createFragmentContainer, graphql } from 'react-relay'
import mapProps from '../../components/MapProps/MapProps'
import { Project, ServerlessFunction } from '../../types/types'
import FunctionRow from './FunctionRow'

interface Props {
  project: Project
  functions: ServerlessFunction[]
  params: any
}

class FunctionsList extends React.Component<Props, {}> {
  render() {
    const { functions } = this.props
    return (
      <div className="functions">
        <style jsx={true}>{`
          .functions {
            @p: .w100;
          }
          table {
            @p: .w100;
            border-collapse: collapse;
          }
          thead {
            @p: .bgBlack04, .bb;
            border-color: rgba(23, 42, 58, 0.06);
          }
          th {
            @p: .pa20, .f14, .fw6, .o30, .darkerBlue, .ttu, .tl;
          }
          .empty {
            @p: .tc, .pa60, .darkBlue50, .f20;
          }
        `}</style>
        {functions.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Event Type</th>
                <th>Last 30min Invocations</th>
                <th>Logs</th>
              </tr>
            </thead>
            <tbody>
              {functions.map(fn => (
                <FunctionRow
                  key={fn.id}
                  fn={fn}
                  params={this.props.params}
                  isEjected={this.props.project.isEjected}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            There are no functions yet. Click "New Function" to define a new
            one.
          </div>
        )}
      </div>
    )
  }
}

const FunctionsListMapped = mapProps({
  functions: props => props.project.functions.edges.map(edge => edge.node),
})(FunctionsList)

export default createFragmentContainer(FunctionsListMapped, {
  project: graphql`
    fragment FunctionsList_project on Project {
      name
      isEjected
      functions(first: 1000) {
        edges {
          node {
            id
            ...FunctionRow_fn
          }
        }
      }
    }
  `,
})
