import { defineFixture } from '../../component-fixtures/component-fixture'
import { UseCaseStep } from './UseCaseStep'

export const everydaySelected = defineFixture({
  width: 1000,
  render: () => <UseCaseStep useCase="everyday" onSelect={() => {}} />
})

export const codeSelected = defineFixture({
  width: 1000,
  render: () => <UseCaseStep useCase="code" onSelect={() => {}} />
})
