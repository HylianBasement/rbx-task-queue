interface SignalLike {
	Connect(callback: Callback): { Disconnect(): void };
}

/** Queue of cancellable tasks that is shifted and resumed whenever a task finishes. */
class TaskQueue<T extends Array<unknown> = []> {
	private queue = new Array<thread>();

	private bulkCancel = new Instance("BindableEvent");

	private cancel(index: number) {
		const thread = this.queue.remove(index);

		if (thread) {
			task.cancel(thread);
		}
	}

	private consume() {
		if (this.queue.size() > 0) {
			task.spawn(this.queue[0]);
		}
	}

	/**
	 * Enqueues a cancellable task that is executed whenever the queue is shifted and it becomes the first entry.
	 *
	 * Tasks can be cancelled whenever a signal of its dependencies list is fired.
	 * @param executor The callback to be executed.
	 * @param dependencies A list of signals used to cancel the task.
	 */
	public AddTask(
		executor: (...parameters: T) => void | Promise<void>,
		dependencies: Array<SignalLike> = [],
		...args: T
	) {
		const threadFinished = new Instance("BindableEvent");
		const newThread = coroutine.create((callback: (...parameters: T) => void | Promise<void>, ...params: T) => {
			coroutine.yield();
			const result = callback(...params);

			if (Promise.is(result)) {
				result.await();
			}

			task.defer(() => {
				threadFinished.Fire();
				this.consume();
			});

			coroutine.yield();
		});

		task.spawn(newThread, executor, ...args);

		const index = this.queue.push(newThread) - 1;

		Promise.race(
			[this.bulkCancel.Event, threadFinished.Event, ...dependencies].map((signal) =>
				Promise.fromEvent(signal).then(() => {
					this.cancel(this.queue.findIndex((th) => th === newThread));
					threadFinished.Destroy();
				}),
			),
		);

		if (index === 0) {
			this.consume();
		}

		return this;
	}

	/**
	 * Adds a promise to the queue that gets cancelled if it does not resolve before it's consumed.
	 *
	 * Sugar for:
	 * ```ts
	 * queue.AddTask(() => {
	 * 		promise.cancel();
	 * });
	 * ```
	 *
	 * @param promise The promise to be possibly cancelled.
	 */
	public AddPromise(promise: Promise<unknown>) {
		const promiseThread = coroutine.create(() => {
			coroutine.yield();

			task.defer(() => this.consume());

			promise.cancel();
			coroutine.yield();
		});

		const position = this.queue.push(promiseThread);

		Promise.race([promise, Promise.fromEvent(this.bulkCancel.Event)])
			.finally(() => this.cancel(this.queue.findIndex((th) => th === promiseThread)))
			.finallyCall(task.spawn, promiseThread);

		if (position === 1) {
			task.spawn(promiseThread);
		}

		return this;
	}

	/** Cancels the current task and all the other pending ones. */
	public Clear() {
		this.bulkCancel.Fire();
	}

	/** Returns the current length of the queue. */
	public GetLength() {
		return this.queue.size();
	}
}

export = TaskQueue;
