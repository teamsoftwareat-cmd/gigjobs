import React, { useState, useRef, useEffect } from 'react'
import './MultiSelectDropdown.css'

const MultiSelectDropdown = ({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [filteredOptions, setFilteredOptions] = useState([])
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = options.filter((opt) =>
        opt.label.toLowerCase().includes(inputValue.toLowerCase())
      )
      setFilteredOptions(filtered)
    } else {
      setFilteredOptions(options)
    }
  }, [inputValue, options])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddValue = (value) => {
    if (!value || !value.trim()) return

    const newValue = value.trim()
    if (!selectedValues.includes(newValue)) {
      onChange([...selectedValues, newValue])
    }
    setInputValue('')
    setFilteredOptions(options)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      handleAddValue(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && selectedValues.length > 0) {
      const newSelected = [...selectedValues]
      newSelected.pop()
      onChange(newSelected)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setInputValue('')
    }
  }

  const handleSelectOption = (option) => {
    if (!selectedValues.includes(option.value)) {
      onChange([...selectedValues, option.value])
    }
    setInputValue('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const removeSelected = (value) => {
    onChange(selectedValues.filter((v) => v !== value))
  }

  const getSelectedLabels = () => {
    return selectedValues.map((val) => {
      const option = options.find((opt) => opt.value === val)
      return option ? option.label : val
    })
  }

  return (
    <div className="multi-select-dropdown" ref={dropdownRef}>
      <div className="dropdown-header" onClick={() => setIsOpen(true)}>
        <div className="selected-items">
          {getSelectedLabels().map((label) => (
            <span key={label} className="selected-tag">
              {label}
              <button
                type="button"
                className="remove-tag"
                onClick={(e) => {
                  e.stopPropagation()
                  const value = options.find((opt) => opt.label === label)?.value || label
                  removeSelected(value)
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="dropdown-input"
            placeholder={selectedValues.length === 0 ? placeholder : ''}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(true)
            }}
          />
        </div>
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`dropdown-option ${selectedValues.includes(option.value) ? 'selected' : ''}`}
                  onClick={() => handleSelectOption(option)}
                >
                  <i className={`fas fa-${selectedValues.includes(option.value) ? 'check-square' : 'square'}`}></i>
                  <span>{option.label}</span>
                </div>
              ))
            ) : (
              <div className="no-options">
                {inputValue ? (
                  <div className="add-new-option">
                    <span>Press Enter to add "{inputValue}"</span>
                  </div>
                ) : (
                  'No options available'
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MultiSelectDropdown
