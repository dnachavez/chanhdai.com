export function ChanhDaiMark(props: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 512 256"
      aria-hidden
      {...props}
    >
      <path
        fill="currentColor"
        d="M0 0H192V64H0ZM384 0H512V64H384ZM0 64H64V128H0ZM192 64H256V128H192ZM320 64H384V128H320ZM0 128H64V192H0ZM192 128H256V192H192ZM320 128H384V192H320ZM0 192H192V256H0ZM384 192H512V256H384Z"
      />
    </svg>
  )
}

export function getMarkSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 256 128"><path fill="currentColor" d="M0 0H96V32H0ZM192 0H256V32H192ZM0 32H32V64H0ZM96 32H128V64H96ZM160 32H192V64H160ZM0 64H32V96H0ZM96 64H128V96H96ZM160 64H192V96H160ZM0 96H96V128H0ZM192 96H256V128H192Z"/></svg>`
}
