import { describe, it, expect } from 'vitest'
import { isEditableTarget } from './keyboard'

describe('isEditableTarget', () => {
  it('is true for every element the user can type in', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('select'))).toBe(true)

    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    expect(isEditableTarget(editable)).toBe(true)
  })

  it('is false for non-editable elements and missing targets', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false)
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(document.createElement('canvas'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
