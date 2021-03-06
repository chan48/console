import * as React from 'react'
import { createFragmentContainer, graphql } from 'react-relay'
import { Model } from '../../../../types/types'
import ModelPermissionsHeader from './ModelPermissionsHeader'
import ModelPermissionList from './ModelPermissionList'
import { $p, variables } from 'graphcool-styles'
import * as cx from 'classnames'
import styled from 'styled-components'

interface Props {
  model: Model
  params: any
  style: any
}

const Container = styled.div`
  &:before {
    width: 100%;
    height: 1px;
    position: absolute;
    border-bottom: 1px solid ${variables.gray07};
    top: 19px;
    content: "";
    z-index: -1;
  }
`

class ModelPermissions extends React.Component<Props, {}> {
  render() {
    const { model, params, style } = this.props
    return (
      <Container
        className={cx($p.mt38, $p.mb16, $p.relative, $p.z5)}
        style={style}
      >
        <div className={$p.ph16}>
          <ModelPermissionsHeader params={params} model={model} />
          <ModelPermissionList params={params} model={model} />
        </div>
      </Container>
    )
  }
}

export default createFragmentContainer(ModelPermissions, {
  model: graphql`
    fragment ModelPermissions_model on Model {
      ...ModelPermissionsHeader_model
      ...ModelPermissionList_model
    }
  `,
})
