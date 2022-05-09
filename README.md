# TaskQueue

In the example below, we add two tasks to the queue, and the first one yields longer than the main thread does. Because the cancel request is sent before the `task.wait(3)` in the first task had finished, "b" and "c" will not print.

```js
import TaskQueue from "@rbxts/task-queue";

const queue = new TaskQueue();

queue.AddTask(() => {
    print("a");
    task.wait(3);
    print("b");
    task.wait(1);
});

queue.AddTask(() => {
    print("c");
});

task.wait(2);
queue.Clear();
```

Events can be registered as dependencies for the queue, so that when one of its events is fired, the queue will cancel all the tasks that contains that event.

```js
import { myEvent } from "./events";

queue.AddTask(() => {
    task.wait(3);
    print("hello there");
}, [myEvent]);

// will prevent the task from printing "hello there"
myEvent.Fire();
```

Additionally, there is a method exclusive to promises, but the way it works is different from `AddTask`. Instead of resolving the promise when its thread is consumed by the queue, it'll be cancelled.

```js
const promise = new Promise((resolve) => {
    const status = getPlayerStatus();
    resolve(status);
}).timeout(60);

queue.AddTask(() => { ... });
// ...

queue.AddPromise(promise);
```

This is essentially a sugar for:
```js
queue.AddTask(() => {
    promise.cancel();
});
```