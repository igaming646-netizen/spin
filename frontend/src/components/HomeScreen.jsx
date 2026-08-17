import React from 'react'
import styles from './HomeScreen.module.css'

export default function HomeScreen({ charCount, hasPending, onGoList, onGoSpin }) {
  return (
    <div className={styles.home}>
      <div className={styles.title}>⚔️ Spin Battle</div>
      <div className={styles.sub}>Quay số phận • Chiến đấu • Vinh quang</div>
      <div className={styles.btns}>
        <button className={styles.btn} onClick={onGoList}>
          <span className={styles.icon}>📋</span>
          Danh sách
          {charCount > 0 && <span className={styles.badge}>{charCount} nhân vật</span>}
        </button>
        <button className={`${styles.btn} ${styles.primary}`} onClick={onGoSpin}>
          <span className={styles.icon}>🎰</span>
          Vòng quay
          {hasPending && <span className={styles.badge}>Đang dở</span>}
        </button>
      </div>
    </div>
  )
}
