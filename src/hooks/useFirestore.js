import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useFirestore(uid, key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);
  const latestValue = useRef(initialValue);
  const [isReady, setIsReady] = useState(false);
  
  // 변경사항 등록 및 타이머
  const pendingRev = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!uid) {
      latestValue.current = initialValue;
      setStoredValue(initialValue);
      setIsReady(true);
      return;
    }

    const docRef = doc(db, 'users', uid, 'plannerData', key);
    setIsReady(false);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      // 서버에서 온 데이터
      // 로컬에 처리 중인(대기 중인) 쓰기 작업이 있다면 서버 스냅샷을 덮어쓰지 않습니다.
      if (pendingRev.current > 0) {
        return;
      }

      if (docSnap.exists()) {
        const newData = docSnap.data().value;
        latestValue.current = newData;
        setStoredValue(newData);
      } else {
        latestValue.current = initialValue;
        setStoredValue(initialValue);
      }
      setIsReady(true);
    });

    return () => unsubscribe();
  }, [uid, key]); // initialValue는 제외하여 불필요한 재구독 방지

  const setValue = useCallback((value) => {
    // 1. 최신 상태를 기반으로 다음 저장 값을 계산
    const valueToStore = value instanceof Function ? value(latestValue.current) : value;
    
    // 2. 화면(로컬 상태)에 즉시 반영
    latestValue.current = valueToStore;
    setStoredValue(valueToStore);
    
    // 3. 로컬 작업 번호(revision) 발급 및 대기 플래그 활성화
    const currentRev = ++pendingRev.current;

    // 4. 디바운스 처리
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(async () => {
      if (uid) {
        try {
          const docRef = doc(db, 'users', uid, 'plannerData', key);
          await setDoc(docRef, { value: valueToStore });
        } catch (error) {
          console.error("Firestore save error:", error);
        } finally {
          // 마지막으로 실행된 작업이라면 대기 플래그를 해제
          if (pendingRev.current === currentRev) {
            pendingRev.current = 0;
          }
        }
      } else {
        if (pendingRev.current === currentRev) {
          pendingRev.current = 0;
        }
      }
    }, 500);
  }, [uid, key]);

  return [storedValue, setValue, isReady];
}
